"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
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
import { panelClass } from "@/lib/ui";

export type TraceGraphNodeType = "requirement" | "workItem" | "testCase";

export type TraceGraphNode = {
  id: string;
  type: TraceGraphNodeType;
  label: string;
  title: string;
  status?: string;
  /** Requirement nodes only: number of findings tied to the requirement. */
  findingCount?: number;
  /** Requirement nodes only: true when the requirement lacks linked work or tests. */
  hasGap?: boolean;
  /** Requirement nodes only: link to the requirement detail page. */
  href?: string;
};

export type TraceGraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

type TraceNodeData = TraceGraphNode & { dimmed?: boolean };

const typeLabels: Record<TraceGraphNodeType, string> = {
  requirement: "Requirement",
  workItem: "Work item",
  testCase: "Test"
};

const columnX: Record<TraceGraphNodeType, number> = {
  requirement: 0,
  workItem: 320,
  testCase: 640
};

const nodeWidth: Record<TraceGraphNodeType, number> = {
  requirement: 250,
  workItem: 250,
  testCase: 330
};

const ROW_HEIGHT = 84;
const GRAPH_WIDTH = columnX.testCase + nodeWidth.testCase;

const typeColors: Record<TraceGraphNodeType, string> = {
  requirement: "var(--accent-strong)",
  workItem: "var(--info)",
  testCase: "var(--muted)"
};

function nodeColor(node: TraceGraphNode): string {
  if (node.type === "testCase" && node.status) {
    return testStatusColor(node.status) ?? typeColors.testCase;
  }

  if (node.type === "requirement" && node.hasGap) {
    return "var(--warning)";
  }

  return typeColors[node.type];
}

function TraceNode({ data }: NodeProps<TraceNodeData>) {
  const color = nodeColor(data);
  const failing = data.status === "failed" || data.status === "errored";

  return (
    <div
      className="border bg-[var(--panel-strong)] px-3 py-2 text-left text-[var(--foreground)] shadow-sm"
      style={{
        width: nodeWidth[data.type],
        borderColor: color,
        borderWidth: failing ? 2 : 1,
        borderStyle: data.type === "requirement" && data.hasGap ? "dashed" : "solid"
      }}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !min-w-0 !border-0 !bg-[var(--line)]" />
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wide" style={{ color }}>
        <span>{typeLabels[data.type]}</span>
        {data.type === "testCase" && data.status ? <span>{data.status}</span> : null}
        {data.type === "requirement" && data.findingCount ? (
          <span>
            {data.findingCount} finding{data.findingCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold" title={data.label}>
        {data.label}
      </div>
      {data.type !== "testCase" ? (
        <div className="truncate text-xs text-[var(--muted)]" title={data.title}>
          {data.title}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !min-w-0 !border-0 !bg-[var(--line)]" />
    </div>
  );
}

// Defined once at module scope so React Flow keeps the same node types between
// renders. (In development, React Strict Mode still triggers React Flow's
// "new nodeTypes object" warning 002 because it runs useMemo twice.)
const nodeTypes = { trace: TraceNode };
const edgeTypes = {};

function neighborIds(nodeIds: Set<string>, edges: TraceGraphEdge[]): Set<string> {
  const result = new Set(nodeIds);
  edges.forEach((edge) => {
    if (nodeIds.has(edge.source)) {
      result.add(edge.target);
    }
    if (nodeIds.has(edge.target)) {
      result.add(edge.source);
    }
  });
  return result;
}

/**
 * Lay nodes out in three columns. Work items and tests are ordered by the first
 * requirement they trace to, which keeps most edges short and roughly horizontal.
 */
function layout(nodes: TraceGraphNode[], edges: TraceGraphEdge[]): Map<string, { x: number; y: number }> {
  const requirementOrder = new Map(
    nodes.filter((node) => node.type === "requirement").map((node, index) => [node.id, index])
  );
  const firstRequirement = new Map<string, number>();
  edges.forEach((edge) => {
    const pairs: Array<[string, string]> = [
      [edge.source, edge.target],
      [edge.target, edge.source]
    ];
    pairs.forEach(([requirementId, otherId]) => {
      const order = requirementOrder.get(requirementId);
      if (order === undefined || requirementOrder.has(otherId)) {
        return;
      }
      firstRequirement.set(otherId, Math.min(firstRequirement.get(otherId) ?? Number.MAX_SAFE_INTEGER, order));
    });
  });

  const positions = new Map<string, { x: number; y: number }>();
  (["requirement", "workItem", "testCase"] as const).forEach((type) => {
    nodes
      .filter((node) => node.type === type)
      .map((node, index) => ({
        node,
        rank: type === "requirement" ? index : (firstRequirement.get(node.id) ?? Number.MAX_SAFE_INTEGER),
        index
      }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .forEach(({ node }, row) => {
        positions.set(node.id, { x: columnX[type], y: row * ROW_HEIGHT });
      });
  });

  return positions;
}

const legend = [
  { label: "Requirement", color: "var(--accent-strong)", dashed: false },
  { label: "Requirement missing work or tests", color: "var(--warning)", dashed: true },
  { label: "Work item", color: "var(--info)", dashed: false },
  { label: "Passed test", color: "var(--success)", dashed: false },
  { label: "Failed or errored test", color: "var(--danger)", dashed: false },
  { label: "Skipped test", color: "var(--muted)", dashed: false }
];

const fieldClass = "min-h-10 border border-[var(--line)] bg-[var(--panel)] px-3 text-sm";

export function TraceGraphClient({ nodes, edges }: { nodes: TraceGraphNode[]; edges: TraceGraphEdge[] }) {
  const [focusId, setFocusId] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);

  const requirements = useMemo(() => nodes.filter((node) => node.type === "requirement"), [nodes]);
  const gapCount = useMemo(() => requirements.filter((node) => node.hasGap || node.findingCount).length, [requirements]);
  const focused = requirements.find((node) => node.id === focusId) ?? null;

  const visibleIds = useMemo(() => {
    if (focusId) {
      return neighborIds(new Set([focusId]), edges);
    }

    if (gapsOnly) {
      const gapRequirementIds = new Set(
        requirements.filter((node) => node.hasGap || node.findingCount).map((node) => node.id)
      );
      return neighborIds(gapRequirementIds, edges);
    }

    return null;
  }, [focusId, gapsOnly, requirements, edges]);

  const visibleNodes = useMemo(
    () => (visibleIds ? nodes.filter((node) => visibleIds.has(node.id)) : nodes),
    [nodes, visibleIds]
  );
  const visibleEdges = useMemo(
    () => (visibleIds ? edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)) : edges),
    [edges, visibleIds]
  );

  const flowNodes = useMemo<Node<TraceNodeData>[]>(() => {
    const positions = layout(visibleNodes, visibleEdges);
    return visibleNodes.map((node) => ({
      id: node.id,
      type: "trace",
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: node,
      connectable: false
    }));
  }, [visibleNodes, visibleEdges]);

  const statusById = useMemo(() => new Map(nodes.map((node) => [node.id, node.status])), [nodes]);
  const flowEdges = useMemo<Edge[]>(
    () =>
      visibleEdges.map((edge) => {
        const targetStatus = statusById.get(edge.target);
        const failing = targetStatus === "failed" || targetStatus === "errored";
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          // Link-type labels only help once the graph is small enough to read.
          label: visibleIds ? edge.label : undefined,
          labelStyle: { fill: "var(--muted)", fontSize: 11 },
          labelBgStyle: { fill: "var(--panel)" },
          style: { stroke: failing ? "var(--danger)" : "var(--muted)", strokeOpacity: failing ? 0.9 : 0.45 }
        };
      }),
    [visibleEdges, statusById, visibleIds]
  );

  function focusOn(id: string) {
    setFocusId(id);
  }

  function toggleGapsOnly(next: boolean) {
    setGapsOnly(next);
    setFocusId("");
  }

  // Start at the top of the columns with a readable zoom. A single focused
  // requirement is small, so that view is fitted to the canvas instead.
  function showTop(flow: ReactFlowInstance) {
    const width = document.getElementById("trace-graph-canvas")?.clientWidth ?? GRAPH_WIDTH;
    const zoom = Math.min(1, Math.max(0.35, (width - 48) / GRAPH_WIDTH));
    flow.setViewport({ x: Math.max(24, (width - GRAPH_WIDTH * zoom) / 2), y: 24, zoom });
  }

  const counts = {
    requirement: visibleNodes.filter((node) => node.type === "requirement").length,
    workItem: visibleNodes.filter((node) => node.type === "workItem").length,
    testCase: visibleNodes.filter((node) => node.type === "testCase").length
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className={`${panelClass} grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end`}>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,320px)_auto] sm:items-end">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Focus on a requirement</span>
            <select
              value={focusId}
              onChange={(event) => focusOn(event.target.value)}
              className={`mt-1 w-full ${fieldClass}`}
            >
              <option value="">All requirements</option>
              {requirements.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label} — {node.title}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Which requirements to show" className="flex min-h-10 w-fit border border-[var(--line)] text-sm">
            {[
              { value: false, label: "All" },
              { value: true, label: `Needs attention (${gapCount})` }
            ].map((option) => {
              const pressed = gapsOnly === option.value && !focusId;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggleGapsOnly(option.value)}
                  className={`whitespace-nowrap px-3 focus-visible:outline-offset-[-2px] ${
                    pressed ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-sm text-[var(--muted)] lg:text-right">
          Showing {counts.requirement} requirement{counts.requirement === 1 ? "" : "s"}, {counts.workItem} work item
          {counts.workItem === 1 ? "" : "s"}, {counts.testCase} test{counts.testCase === 1 ? "" : "s"}
          {focused?.href ? (
            <>
              {" · "}
              <Link href={focused.href} className="text-[var(--accent-strong)] hover:underline">
                Open {focused.label} →
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <div id="trace-graph-canvas" className={`h-[70vh] min-h-[420px] ${panelClass}`}>
        <ReactFlow
          // Remount when the filter changes so each view gets a fresh viewport.
          key={`${focusId}|${gapsOnly}`}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={Boolean(focusId)}
          fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
          onInit={(flow) => {
            if (!focusId) {
              showTop(flow);
            }
          }}
          onNodeClick={(_event, node) => {
            if (node.data.type === "requirement") {
              focusOn(node.id);
            }
          }}
          nodesConnectable={false}
          panOnScroll
          zoomOnScroll={false}
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background color="var(--line)" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--muted)]" aria-label="Legend">
        {legend.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-5 border bg-[var(--panel-strong)]"
              style={{ borderColor: item.color, borderStyle: item.dashed ? "dashed" : "solid" }}
            />
            {item.label}
          </span>
        ))}
        <span>Click a requirement to focus on its links. Scroll to move; use the controls or pinch to zoom.</span>
      </div>
    </div>
  );
}
