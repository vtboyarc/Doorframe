import type { EntityType, Finding, ProjectData, TraceLink } from "@doorframe/core";
import { requirementRows } from "./view-models";

// Trace graph data, layout, and viewport helpers. Everything here is pure so the
// page, the graph API route, and the client component share one tested model.

export type TraceGraphNodeType = EntityType;

/** One card on the trace graph. */
export interface TraceGraphNode {
  id: string;
  type: TraceGraphNodeType;
  /** Requirement or work item external ID; test case name. */
  label: string;
  /** Requirement or work item title; test case class name ("" when the test has none). */
  title: string;
  /** Imported status text; for tests, the result (passed, failed, errored, skipped). */
  status?: string;
  /**
   * Requirements: findings on the requirement and on its linked work items and tests.
   * Work items and tests: findings on the item itself.
   */
  findingCount: number;
  /** Requirements only: true when the requirement has no linked work item or no linked test. */
  hasGap: boolean;
  /** Work items and tests only: true when no trace link connects the item to a requirement. */
  orphan: boolean;
  /** Requirements only: the requirement detail page. */
  href?: string;
}

/** work: requirement to work item. test: requirement to test. requirement: requirement to requirement (e.g. parent). */
export type TraceGraphEdgeKind = "work" | "test" | "requirement";

/** One trace link on the graph. */
export interface TraceGraphEdge {
  id: string;
  /**
   * Always the requirement end of a work or test link. For requirement-to-requirement
   * links, the trace link's source (the parent for parent links).
   */
  source: string;
  target: string;
  /** Trace link type, e.g. implements, verifies, parent. */
  label: string;
  kind: TraceGraphEdgeKind;
}

export interface TraceGraphData {
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
}

// Data ----------------------------------------------------------------------

function findingCounts(findings: Finding[]): Map<string, number> {
  const counts = new Map<string, number>();
  findings.forEach((finding) => {
    counts.set(finding.entityId, (counts.get(finding.entityId) ?? 0) + 1);
  });
  return counts;
}

/**
 * Turn a stored trace link into a graph edge with the requirement end as the
 * source. Returns null for links the graph does not draw: links whose ends are
 * missing from the project, self links, and work item to test links (the graph
 * is organized around requirements).
 */
export function toGraphEdge(link: TraceLink, typeById: Map<string, TraceGraphNodeType>): TraceGraphEdge | null {
  const sourceType = typeById.get(link.sourceId);
  const targetType = typeById.get(link.targetId);
  if (!sourceType || !targetType || link.sourceId === link.targetId) {
    return null;
  }

  if (sourceType === "requirement" && targetType === "requirement") {
    return { id: link.id, source: link.sourceId, target: link.targetId, label: link.linkType, kind: "requirement" };
  }

  const [requirementId, otherId, otherType] =
    sourceType === "requirement"
      ? [link.sourceId, link.targetId, targetType]
      : targetType === "requirement"
        ? [link.targetId, link.sourceId, sourceType]
        : [null, null, null];
  if (!requirementId || !otherId || !otherType) {
    return null;
  }

  return {
    id: link.id,
    source: requirementId,
    target: otherId,
    label: link.linkType,
    kind: otherType === "workItem" ? "work" : "test"
  };
}

/** Nodes and edges for the trace graph page and GET /api/projects/[projectId]/graph. */
export function traceGraphData(data: ProjectData, projectId: string): TraceGraphData {
  const typeById = new Map<string, TraceGraphNodeType>();
  data.requirements.forEach((requirement) => typeById.set(requirement.id, "requirement"));
  data.workItems.forEach((workItem) => typeById.set(workItem.id, "workItem"));
  data.testCases.forEach((testCase) => typeById.set(testCase.id, "testCase"));

  const edges = data.traceLinks.flatMap((link) => toGraphEdge(link, typeById) ?? []);
  const linkedToRequirement = new Set(edges.filter((edge) => edge.kind !== "requirement").map((edge) => edge.target));
  const findings = findingCounts(data.findings);

  const nodes: TraceGraphNode[] = [
    ...requirementRows(data).map((row) => ({
      id: row.id,
      type: "requirement" as const,
      label: row.externalId,
      title: row.title,
      status: row.status,
      findingCount: row.findingCount,
      hasGap: row.linkedWorkCount === 0 || row.linkedTestCount === 0,
      orphan: false,
      href: `/projects/${projectId}/requirements/${encodeURIComponent(row.externalId)}`
    })),
    ...data.workItems.map((workItem) => ({
      id: workItem.id,
      type: "workItem" as const,
      label: workItem.externalId,
      title: workItem.title,
      status: workItem.status,
      findingCount: findings.get(workItem.id) ?? 0,
      hasGap: false,
      orphan: !linkedToRequirement.has(workItem.id)
    })),
    ...data.testCases.map((testCase) => ({
      id: testCase.id,
      type: "testCase" as const,
      label: testCase.name,
      title: testCase.classname ?? "",
      status: testCase.status,
      findingCount: findings.get(testCase.id) ?? 0,
      hasGap: false,
      orphan: !linkedToRequirement.has(testCase.id)
    }))
  ];

  return { nodes, edges };
}

// Views ---------------------------------------------------------------------

/** all: every node. attention: requirements with gaps or findings, their links, and orphan work and tests. */
export type TraceGraphView = "all" | "attention";

/** Projects with more requirements than this open in the "Needs attention" view. */
export const LARGE_PROJECT_REQUIREMENTS = 300;

/** Requirements with a gap or findings, and work items or tests with no requirement. */
export function needsAttention(node: TraceGraphNode): boolean {
  return node.type === "requirement" ? node.hasGap || node.findingCount > 0 : node.orphan;
}

/** The given nodes plus every node one edge away from them. */
export function neighborIds(nodeIds: Set<string>, edges: TraceGraphEdge[]): Set<string> {
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

/** The view a project opens in when the URL does not name one. */
export function defaultView(nodes: TraceGraphNode[]): TraceGraphView {
  const requirementCount = nodes.filter((node) => node.type === "requirement").length;
  return requirementCount > LARGE_PROJECT_REQUIREMENTS && nodes.some(needsAttention) ? "attention" : "all";
}

/** The starting view from a ?view= value; "attention" falls back when nothing needs attention. */
export function initialView(value: string | undefined, nodes: TraceGraphNode[]): TraceGraphView {
  if (value === "all") {
    return "all";
  }
  if (value === "attention" && nodes.some(needsAttention)) {
    return "attention";
  }
  return defaultView(nodes);
}

/**
 * IDs of the nodes to draw, or null for all of them. A focused requirement shows
 * itself and its direct links; the attention view shows requirements that need
 * attention with their direct links, plus orphan work items and tests.
 */
export function visibleNodeIds(graph: TraceGraphData, view: TraceGraphView, focusId: string): Set<string> | null {
  if (focusId) {
    return neighborIds(new Set([focusId]), graph.edges);
  }

  if (view === "attention") {
    const requirementIds = new Set(
      graph.nodes.filter((node) => node.type === "requirement" && needsAttention(node)).map((node) => node.id)
    );
    const result = neighborIds(requirementIds, graph.edges);
    graph.nodes.filter((node) => node.orphan).forEach((node) => result.add(node.id));
    return result;
  }

  return null;
}

/** The nodes in `ids` (all nodes when null) and the edges between them, in their original order. */
export function subgraph(graph: TraceGraphData, ids: Set<string> | null): TraceGraphData {
  if (!ids) {
    return graph;
  }
  return {
    nodes: graph.nodes.filter((node) => ids.has(node.id)),
    edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  };
}

/**
 * For each linked work item and test, the first requirement (in node order) it
 * traces to. Clicking a work item or test focuses that requirement.
 */
export function firstLinkedRequirement(graph: TraceGraphData): Map<string, string> {
  const order = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const result = new Map<string, string>();
  graph.edges.forEach((edge) => {
    if (edge.kind === "requirement" || !order.has(edge.source)) {
      return;
    }
    const current = result.get(edge.target);
    if (current === undefined || (order.get(edge.source) ?? 0) < (order.get(current) ?? 0)) {
      result.set(edge.target, edge.source);
    }
  });
  return result;
}

/**
 * Split a test or requirement label into chunks the browser may wrap between:
 * after "_", ".", "/", ":", or "-", and at lowerCamel to Upper boundaries. The
 * client joins them with <wbr> so long test names wrap at word-like points.
 */
export function labelBreakChunks(label: string): string[] {
  return label.split(/(?<=[_./:-])|(?<=[a-z0-9])(?=[A-Z])/).filter(Boolean);
}

// Layout --------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

/** Work items (left), requirements (middle), tests (right). */
export const COLUMN_X: Record<TraceGraphNodeType, number> = {
  workItem: 0,
  requirement: 330,
  testCase: 670
};

export const NODE_WIDTH: Record<TraceGraphNodeType, number> = {
  workItem: 250,
  requirement: 260,
  testCase: 300
};

/** Every card has the same height so rows line up and bounds are known before render. */
export const NODE_HEIGHT = 84;
export const ROW_HEIGHT = 100;
export const GRAPH_WIDTH = COLUMN_X.testCase + NODE_WIDTH.testCase;

export interface TraceGraphLayout {
  positions: Map<string, Point>;
  /** Number of rows used. */
  rows: number;
  width: number;
  height: number;
}

/**
 * Band layout. Requirements are walked in order; each starts a band at the
 * current row, and its not-yet-placed work items and tests fill rows from the
 * band's top, so cards on the same row are related. The next requirement starts
 * below the tallest column of the band. Work items and tests with no
 * requirement in `edges` go at the end of their columns. Requirement-to-
 * requirement links do not affect rows.
 */
export function layout(nodes: TraceGraphNode[], edges: TraceGraphEdge[]): TraceGraphLayout {
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const linked = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (edge.kind === "requirement" || !indexById.has(edge.source) || !indexById.has(edge.target)) {
      return;
    }
    linked.set(edge.source, [...(linked.get(edge.source) ?? []), edge.target]);
  });

  const rows = new Map<string, number>();
  const nextFree: Record<TraceGraphNodeType, number> = { workItem: 0, requirement: 0, testCase: 0 };
  let cursor = 0;

  nodes
    .filter((node) => node.type === "requirement")
    .forEach((requirement) => {
      rows.set(requirement.id, cursor);
      let lastRow = cursor;
      const start: Record<TraceGraphNodeType, number> = {
        workItem: Math.max(cursor, nextFree.workItem),
        requirement: cursor,
        testCase: Math.max(cursor, nextFree.testCase)
      };
      const members = [...new Set(linked.get(requirement.id) ?? [])]
        .filter((id) => !rows.has(id) && nodes[indexById.get(id) ?? 0].type !== "requirement")
        .sort((left, right) => (indexById.get(left) ?? 0) - (indexById.get(right) ?? 0));
      members.forEach((id) => {
        const type = nodes[indexById.get(id) ?? 0].type;
        rows.set(id, start[type]);
        lastRow = Math.max(lastRow, start[type]);
        start[type] += 1;
        nextFree[type] = start[type];
      });
      cursor = lastRow + 1;
    });

  const orphanRow: Record<TraceGraphNodeType, number> = {
    workItem: Math.max(cursor, nextFree.workItem),
    requirement: cursor,
    testCase: Math.max(cursor, nextFree.testCase)
  };
  nodes.forEach((node) => {
    if (!rows.has(node.id)) {
      rows.set(node.id, orphanRow[node.type]);
      orphanRow[node.type] += 1;
    }
  });

  const positions = new Map<string, Point>();
  let rowCount = 0;
  nodes.forEach((node) => {
    const row = rows.get(node.id) ?? 0;
    rowCount = Math.max(rowCount, row + 1);
    positions.set(node.id, { x: COLUMN_X[node.type], y: row * ROW_HEIGHT });
  });

  return {
    positions,
    rows: rowCount,
    width: GRAPH_WIDTH,
    height: rowCount === 0 ? 0 : (rowCount - 1) * ROW_HEIGHT + NODE_HEIGHT
  };
}

// Viewport ------------------------------------------------------------------

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Fit-to-view never zooms out further than this; it fits the width instead. */
export const MIN_READABLE_ZOOM = 0.5;
export const MAX_FIT_ZOOM = 1.1;
/** Space between the canvas edge and the graph. */
export const VIEW_MARGIN = 24;
/** How far past the laid-out graph users can pan. */
export const PAN_MARGIN = 120;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The area of the graph, in graph units, that a viewport shows on a canvas. */
export function visibleArea(viewport: Viewport, canvas: Size): Rect {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: canvas.width / viewport.zoom,
    height: canvas.height / viewport.zoom
  };
}

/**
 * Pan limits for React Flow's translateExtent: the laid-out graph plus a
 * margin, grown to include the starting view. Including the starting view keeps
 * a short graph where it was placed instead of jumping on the first scroll.
 */
export function panExtent(
  graphLayout: Pick<TraceGraphLayout, "width" | "height">,
  startArea?: Rect
): [[number, number], [number, number]] {
  const minX = Math.min(-PAN_MARGIN, startArea?.x ?? 0);
  const minY = Math.min(-PAN_MARGIN, startArea?.y ?? 0);
  const maxX = Math.max(graphLayout.width + PAN_MARGIN, startArea ? startArea.x + startArea.width : 0);
  const maxY = Math.max(graphLayout.height + PAN_MARGIN, startArea ? startArea.y + startArea.height : 0);
  return [
    [minX, minY],
    [maxX, maxY]
  ];
}

/**
 * The top of the columns: the full column width at a readable zoom (never
 * above 100%, never below {@link MIN_READABLE_ZOOM}), centered when it fits.
 */
export function topViewport(canvas: Size): Viewport {
  const zoom = clamp((canvas.width - 2 * VIEW_MARGIN) / GRAPH_WIDTH, MIN_READABLE_ZOOM, 1);
  return {
    x: Math.max(VIEW_MARGIN, (canvas.width - GRAPH_WIDTH * zoom) / 2),
    y: VIEW_MARGIN,
    zoom
  };
}

/**
 * Fit a small graph (e.g. one focused requirement) to the canvas. When fitting
 * would make text unreadable, fit the width instead and start at the top.
 */
export function fitViewport(graphLayout: Pick<TraceGraphLayout, "width" | "height">, canvas: Size): Viewport {
  const width = Math.max(graphLayout.width, 1);
  const height = Math.max(graphLayout.height, 1);
  const zoom = Math.min(
    MAX_FIT_ZOOM,
    (canvas.width - 2 * VIEW_MARGIN) / width,
    (canvas.height - 2 * VIEW_MARGIN) / height
  );
  if (zoom < MIN_READABLE_ZOOM) {
    return topViewport(canvas);
  }

  return {
    x: (canvas.width - width * zoom) / 2,
    y: (canvas.height - height * zoom) / 2,
    zoom
  };
}

// Notices -------------------------------------------------------------------

export type NoticeSegment = string | { text: string; href: string };

export interface TraceGraphNotice {
  cause: "no-requirements" | "no-work-or-tests" | "no-links";
  segments: NoticeSegment[];
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Why the graph has no requirement links, with links to the page that fixes it.
 * Null when there is nothing to draw at all or at least one requirement link exists.
 */
export function graphNotice(graph: TraceGraphData, projectId: string): TraceGraphNotice | null {
  const count = (type: TraceGraphNodeType) => graph.nodes.filter((node) => node.type === type).length;
  const requirements = count("requirement");
  const workItems = count("workItem");
  const tests = count("testCase");
  const links = graph.edges.filter((edge) => edge.kind !== "requirement").length;
  if (graph.nodes.length === 0 || links > 0) {
    return null;
  }

  const importsHref = `/projects/${projectId}/imports`;
  const single = workItems + tests === 1;
  const singleNoun = workItems === 1 ? "work item" : "test";
  const counts = [
    workItems > 0 ? plural(workItems, "work item", "work items") : "",
    tests > 0 ? plural(tests, "test", "tests") : ""
  ].filter(Boolean);

  if (requirements === 0) {
    return {
      cause: "no-requirements",
      segments: [
        { text: "Import requirements", href: `${importsHref}?type=requirements-csv` },
        ` to connect ${single ? `this ${singleNoun}` : `these ${counts.join(" and ")}`}.`
      ]
    };
  }

  if (workItems === 0 && tests === 0) {
    return {
      cause: "no-work-or-tests",
      segments: [
        "Import a ",
        { text: "Jira CSV", href: `${importsHref}?type=jira-csv` },
        " or ",
        { text: "JUnit XML", href: `${importsHref}?type=junit-xml` },
        ` file that mentions requirement IDs to connect work items and tests to ${
          requirements === 1 ? "this requirement" : `these ${requirements} requirements`
        }.`
      ]
    };
  }

  const sentence = single
    ? `The ${singleNoun} does not mention a requirement ID that matches your ID patterns. `
    : `None of the ${counts.join(" or ")} mention a requirement ID that matches your ID patterns. `;
  return {
    cause: "no-links",
    segments: [sentence, { text: "Check the ID patterns in Settings", href: `/projects/${projectId}/settings` }, "."]
  };
}
