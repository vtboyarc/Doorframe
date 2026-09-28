"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance
} from "reactflow";
import "reactflow/dist/style.css";
import { testStatusColor } from "@/lib/severity";
import {
  MAX_FIT_ZOOM,
  MIN_READABLE_ZOOM,
  NODE_HEIGHT,
  NODE_WIDTH,
  defaultView,
  firstLinkedRequirement,
  fitViewport,
  initialView,
  labelBreakChunks,
  layout,
  needsAttention,
  panExtent,
  subgraph,
  topViewport,
  visibleArea,
  visibleNodeIds,
  type Rect,
  type TraceGraphEdge,
  type TraceGraphNode,
  type TraceGraphNodeType,
  type TraceGraphView
} from "@/lib/trace-graph";
import { chipCountClass, fieldClass, labelClass, panelClass } from "@/lib/ui";
import { traceGraphUrl } from "@/lib/url-state";
import { useUrlState } from "@/lib/use-url-state";

type TraceNodeData = TraceGraphNode & {
  /** The requirement the view is focused on. */
  focused: boolean;
  /** Clicking focuses a requirement: every requirement, and work items and tests with one. */
  clickable: boolean;
};

const typeLabels: Record<TraceGraphNodeType, string> = {
  requirement: "Requirement",
  workItem: "Work item",
  testCase: "Test"
};

const typeColors: Record<TraceGraphNodeType, string> = {
  requirement: "var(--accent-strong)",
  workItem: "var(--info)",
  testCase: "var(--muted)"
};

/** Show a text filter above the requirement picker once it lists more options than this. */
const PICKER_FILTER_THRESHOLD = 50;

// Edges show the connections, so the attachment points stay invisible.
const handleClass = "!h-1 !w-1 !min-w-0 !border-0 !bg-transparent";

function isFailing(status: string | undefined): boolean {
  return status === "failed" || status === "errored";
}

function nodeColor(node: TraceGraphNode): string {
  if (node.type === "testCase" && node.status) {
    return testStatusColor(node.status) ?? typeColors.testCase;
  }

  if (node.type === "requirement" && node.hasGap) {
    return "var(--warning)";
  }

  return typeColors[node.type];
}

function nodeTooltip(node: TraceNodeData): string {
  const lines = [node.label, node.title].filter(Boolean);
  if (node.hasGap) {
    lines.push("Missing linked work or tests.");
  }
  if (node.orphan) {
    lines.push("Not linked to a requirement.");
  } else if (node.clickable && !node.focused) {
    lines.push(node.type === "requirement" ? "Click to focus on its links." : "Click to focus on its requirement.");
  }
  return lines.join("\n");
}

function NodeHandles({ type }: { type: TraceGraphNodeType }) {
  if (type === "workItem") {
    return <Handle type="target" position={Position.Right} className={handleClass} />;
  }

  if (type === "testCase") {
    return <Handle type="target" position={Position.Left} className={handleClass} />;
  }

  return (
    <>
      <Handle type="target" id="top" position={Position.Top} className={handleClass} />
      <Handle type="source" id="left" position={Position.Left} className={handleClass} />
      <Handle type="source" id="right" position={Position.Right} className={handleClass} />
      <Handle type="source" id="bottom" position={Position.Bottom} className={handleClass} />
    </>
  );
}

/** Long test names wrap after separators and at camel case boundaries before breaking mid-word. */
function BreakableText({ text }: { text: string }) {
  return (
    <>
      {labelBreakChunks(text).map((chunk, index) => (
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          {chunk}
        </Fragment>
      ))}
    </>
  );
}

function nodeBadge(data: TraceNodeData): string | null {
  if (data.type === "testCase") {
    return data.status ?? null;
  }
  if (data.type === "requirement" && data.findingCount > 0) {
    return `${data.findingCount} finding${data.findingCount === 1 ? "" : "s"}`;
  }
  return null;
}

function TraceNode({ data }: NodeProps<TraceNodeData>) {
  const color = nodeColor(data);
  const emphasized = data.focused || isFailing(data.status);
  const badge = nodeBadge(data);

  return (
    <div
      title={nodeTooltip(data)}
      className={`flex flex-col overflow-hidden border bg-[var(--panel-strong)] px-3 py-1.5 text-left text-[var(--foreground)] shadow-sm ${
        data.clickable ? "cursor-pointer hover:bg-[var(--line)]" : "cursor-default"
      }`}
      style={{
        width: NODE_WIDTH[data.type],
        height: NODE_HEIGHT,
        borderColor: color,
        borderWidth: emphasized ? 2 : 1,
        borderStyle: data.hasGap || data.orphan ? "dashed" : "solid"
      }}
    >
      <NodeHandles type={data.type} />
      <div
        className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase leading-[14px] tracking-wide"
        style={{ color }}
      >
        <span className="truncate">
          {typeLabels[data.type]}
          {data.orphan ? " · no requirement" : ""}
        </span>
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </div>
      {data.type === "testCase" ? (
        <>
          <div className="mt-0.5 line-clamp-2 text-sm font-semibold leading-[18px] [overflow-wrap:anywhere]">
            <BreakableText text={data.label} />
          </div>
          {data.title ? <div className="truncate text-xs leading-4 text-[var(--muted)]">{data.title}</div> : null}
        </>
      ) : (
        <>
          <div className="mt-0.5 truncate text-sm font-semibold leading-5">{data.label}</div>
          <div className="line-clamp-2 text-xs leading-4 text-[var(--muted)] [overflow-wrap:anywhere]">{data.title}</div>
        </>
      )}
    </div>
  );
}

// Defined once at module scope so React Flow keeps the same node types between
// renders. (In development, React Strict Mode still triggers React Flow's
// "new nodeTypes object" warning 002 because it runs useMemo twice.)
const nodeTypes = { trace: TraceNode };
const edgeTypes = {};

const sourceHandles: Record<TraceGraphEdge["kind"], string> = { work: "left", test: "right", requirement: "bottom" };

function toFlowEdge(edge: TraceGraphEdge, statusById: Map<string, string | undefined>, showLabel: boolean): Edge {
  const failing = edge.kind === "test" && isFailing(statusById.get(edge.target));
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: sourceHandles[edge.kind],
    targetHandle: edge.kind === "requirement" ? "top" : undefined,
    label: showLabel ? edge.label : undefined,
    labelStyle: { fill: "var(--muted)", fontSize: 11 },
    labelBgStyle: { fill: "var(--panel)" },
    style: {
      stroke: failing ? "var(--danger)" : "var(--muted)",
      strokeOpacity: failing ? 0.9 : 0.5,
      strokeDasharray: edge.kind === "requirement" ? "4 3" : undefined
    }
  };
}

const legend = [
  { label: "Requirement", color: "var(--accent-strong)", dashed: false },
  { label: "Requirement missing work or tests", color: "var(--warning)", dashed: true },
  { label: "Work item", color: "var(--info)", dashed: false },
  { label: "Work item or test with no requirement", color: "var(--muted)", dashed: true },
  { label: "Passed test", color: "var(--success)", dashed: false },
  { label: "Failed or errored test", color: "var(--danger)", dashed: false },
  { label: "Skipped test", color: "var(--muted)", dashed: false }
];

const fitViewOptions = { padding: 0.1, minZoom: MIN_READABLE_ZOOM, maxZoom: MAX_FIT_ZOOM };

function BackToTopIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="2" width="24" height="4" />
      <path d="M16 8 27 20h-7v10h-8V20H5z" />
    </svg>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function TraceGraphClient({
  nodes,
  edges,
  initialFocus,
  initialView: initialViewParam
}: {
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
  /** Requirement external ID from ?focus=. */
  initialFocus?: string;
  /** Value of ?view=. */
  initialView?: string;
}) {
  const graph = useMemo(() => ({ nodes, edges }), [nodes, edges]);
  const requirements = useMemo(() => nodes.filter((node) => node.type === "requirement"), [nodes]);
  const attentionCount = useMemo(() => nodes.filter(needsAttention).length, [nodes]);
  const startingView = useMemo(() => defaultView(nodes), [nodes]);
  const firstRequirement = useMemo(() => firstLinkedRequirement(graph), [graph]);

  // Prefer the current URL over the server-rendered props: after browser Back, Next can restore this
  // page from a render made before a requirement was picked, while the URL still carries it.
  const searchParams = useSearchParams();
  const [view, setView] = useState<TraceGraphView>(() => initialView(searchParams.get("view") ?? initialViewParam, nodes));
  const [focusId, setFocusId] = useState(
    () => requirements.find((node) => node.label === (searchParams.get("focus") ?? initialFocus))?.id ?? ""
  );
  const [pickerFilter, setPickerFilter] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null);
  // The area the starting view shows; pan limits include it so that view never shifts.
  const [startArea, setStartArea] = useState<Rect | undefined>(undefined);

  const focused = requirements.find((node) => node.id === focusId) ?? null;

  // Keep ?focus= and ?view= in the address bar without a server navigation, and follow the
  // address when it changes from outside (the Trace graph tab, browser Back or Forward).
  const pathname = usePathname();
  const url = useMemo(
    () => traceGraphUrl(pathname, { focus: focused?.label, view, defaultView: startingView }),
    [pathname, focused?.label, view, startingView]
  );
  useUrlState(url, (params) => {
    setView(initialView(params.get("view") ?? undefined, nodes));
    setFocusId(requirements.find((node) => node.label === params.get("focus"))?.id ?? "");
  });

  const visible = useMemo(() => subgraph(graph, visibleNodeIds(graph, view, focusId)), [graph, view, focusId]);
  const graphLayout = useMemo(() => layout(visible.nodes, visible.edges), [visible]);
  const translateExtent = useMemo(() => panExtent(graphLayout, startArea), [graphLayout, startArea]);

  const flowNodes = useMemo<Node<TraceNodeData>[]>(
    () =>
      visible.nodes.map((node) => ({
        id: node.id,
        type: "trace",
        position: graphLayout.positions.get(node.id) ?? { x: 0, y: 0 },
        // Known sizes let React Flow skip off-screen cards before measuring them.
        width: NODE_WIDTH[node.type],
        height: NODE_HEIGHT,
        data: {
          ...node,
          focused: node.id === focusId,
          clickable: node.type === "requirement" || firstRequirement.has(node.id)
        },
        connectable: false
      })),
    [visible, graphLayout, focusId, firstRequirement]
  );

  const statusById = useMemo(() => new Map(nodes.map((node) => [node.id, node.status])), [nodes]);
  const flowEdges = useMemo<Edge[]>(
    // Link-type labels only help once the graph is small enough to read.
    () => visible.edges.map((edge) => toFlowEdge(edge, statusById, Boolean(focusId))),
    [visible, statusById, focusId]
  );

  // Fit the drawn subset (fit = true) or show the top of the columns, and let
  // the pan limits include that view so the first scroll does not shift it.
  const showView = useCallback(
    (fit: boolean) => {
      if (!flow || !canvas) {
        return;
      }
      const size = { width: canvas.clientWidth, height: canvas.clientHeight };
      const viewport = fit ? fitViewport(graphLayout, size) : topViewport(size);
      setStartArea(visibleArea(viewport, size));
      flow.setViewport(viewport);
    },
    [flow, canvas, graphLayout]
  );

  // Reposition the single React Flow instance whenever the drawn subset changes:
  // fit a focused requirement, otherwise show the top of the columns.
  useEffect(() => {
    showView(Boolean(focusId));
  }, [showView, focusId]);

  function chooseView(next: TraceGraphView) {
    setView(next);
    setFocusId("");
  }

  // The picker lists the requirements in the current view (plus the focused one).
  const viewRequirements = useMemo(() => {
    if (view === "all") {
      return requirements;
    }
    const ids = visibleNodeIds(graph, view, "");
    return requirements.filter((node) => !ids || ids.has(node.id));
  }, [graph, requirements, view]);

  const showPickerFilter = viewRequirements.length > PICKER_FILTER_THRESHOLD;
  const pickerOptions = useMemo(() => {
    const query = showPickerFilter ? pickerFilter.trim().toLowerCase() : "";
    const matches = query
      ? viewRequirements.filter((node) => `${node.label} ${node.title}`.toLowerCase().includes(query))
      : viewRequirements;
    return focused && !matches.includes(focused) ? [focused, ...matches] : matches;
  }, [viewRequirements, pickerFilter, showPickerFilter, focused]);

  const counts = {
    requirement: visible.nodes.filter((node) => node.type === "requirement").length,
    workItem: visible.nodes.filter((node) => node.type === "workItem").length,
    testCase: visible.nodes.filter((node) => node.type === "testCase").length
  };
  const largeProjectNote =
    view === "attention" && !focusId && startingView === "attention"
      ? "Large project: showing requirements that need attention. Pick a requirement to focus."
      : null;

  const viewOptions: Array<{ value: TraceGraphView; label: string; count?: number; disabled: boolean }> = [
    { value: "all", label: "All", disabled: false },
    {
      value: "attention",
      label: attentionCount > 0 ? "Needs attention" : "Nothing needs attention",
      count: attentionCount > 0 ? attentionCount : undefined,
      disabled: attentionCount === 0
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className={`${panelClass} grid min-w-0 gap-3 p-3`}>
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <label htmlFor="trace-graph-focus" className="block text-sm text-[var(--muted)]">
              Focus on a requirement
            </label>
            <div
              className={`mt-1 grid min-w-0 gap-2 ${
                showPickerFilter ? "sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,28rem)]"
              }`}
            >
              {showPickerFilter ? (
                <input
                  type="search"
                  value={pickerFilter}
                  onChange={(event) => setPickerFilter(event.target.value)}
                  placeholder="Filter by ID or title"
                  aria-label="Filter the requirement list by ID or title"
                  aria-controls="trace-graph-focus"
                  className={fieldClass}
                />
              ) : null}
              <select
                id="trace-graph-focus"
                value={focusId}
                onChange={(event) => setFocusId(event.target.value)}
                className={fieldClass}
              >
                <option value="">All requirements in this view</option>
                {pickerOptions.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label} — {node.title}
                  </option>
                ))}
                {pickerOptions.length === 0 && pickerFilter ? (
                  <option value="no-match" disabled>
                    No requirements match the filter
                  </option>
                ) : null}
              </select>
            </div>
          </div>
          <div
            role="group"
            aria-label="Which requirements to show"
            className="flex min-h-10 w-fit max-w-full border border-[var(--line-strong)] text-sm"
          >
            {viewOptions.map((option) => {
              const pressed = view === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={pressed}
                  disabled={option.disabled}
                  onClick={() => chooseView(option.value)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap px-3 focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-60 ${
                    pressed
                      ? "bg-[var(--info-soft)] text-[var(--foreground)] shadow-[inset_0_0_0_1px_var(--accent-strong)]"
                      : "text-[var(--muted)] enabled:hover:text-[var(--foreground)]"
                  }`}
                >
                  {option.label}
                  {option.count !== undefined ? <span className={chipCountClass}>{option.count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
          <p className="min-w-0" aria-live="polite">
            Showing {plural(counts.requirement, "requirement", "requirements")},{" "}
            {plural(counts.workItem, "work item", "work items")}, {plural(counts.testCase, "test", "tests")}
            {focused?.href ? (
              <>
                {" · "}
                <Link href={focused.href} className="text-[var(--accent-strong)] hover:underline">
                  Open {focused.label} <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : null}
          </p>
          {largeProjectNote ? <p className="min-w-0 text-[var(--info)]">{largeProjectNote}</p> : null}
        </div>
      </div>

      <div ref={setCanvas} className={`h-[70vh] min-h-[420px] min-w-0 ${panelClass}`}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setFlow}
          onNodeClick={(_event, node: Node<TraceNodeData>) => {
            const target = node.data.type === "requirement" ? node.id : firstRequirement.get(node.id);
            if (target) {
              setFocusId(target);
            }
          }}
          onlyRenderVisibleElements
          translateExtent={translateExtent}
          fitViewOptions={fitViewOptions}
          nodesConnectable={false}
          nodesDraggable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          disableKeyboardA11y
          panOnScroll
          zoomOnScroll={false}
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background color="var(--line)" gap={24} />
          <Controls showInteractive={false} fitViewOptions={fitViewOptions}>
            <ControlButton onClick={() => showView(false)} title="Back to top" aria-label="Back to top">
              <BackToTopIcon />
            </ControlButton>
          </Controls>
        </ReactFlow>
      </div>

      <div className="grid min-w-0 gap-2 text-xs text-[var(--muted)]">
        <h2 id="trace-graph-legend" className={labelClass}>
          Legend
        </h2>
        <ul aria-labelledby="trace-graph-legend" className="flex flex-wrap gap-x-5 gap-y-2">
          {legend.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-5 border bg-[var(--panel-strong)]"
                style={{ borderColor: item.color, borderStyle: item.dashed ? "dashed" : "solid" }}
              />
              {item.label}
            </li>
          ))}
        </ul>
        <p>Click a card to focus on its requirement. Scroll or drag to move; use the controls to zoom.</p>
      </div>
    </div>
  );
}
