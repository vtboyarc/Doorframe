import { describe, expect, it } from "vitest";
import type { Finding, ProjectData, Requirement, TestCase, TraceLink, WorkItem } from "@doorframe/core";
import {
  COLUMN_X,
  GRAPH_WIDTH,
  MIN_READABLE_ZOOM,
  NARROW_ZOOM,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_HEIGHT,
  defaultView,
  firstLinkedRequirement,
  fitViewport,
  graphNotice,
  initialView,
  layout,
  neighborIds,
  panExtent,
  subgraph,
  topViewport,
  traceGraphData,
  visibleNodeIds,
  type TraceGraphData,
  type TraceGraphEdge,
  type TraceGraphNode
} from "./trace-graph";

const stamp = { projectId: "p1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

function requirement(id: string, externalId: string, extra: Partial<Requirement> = {}): Requirement {
  return { ...stamp, id, externalId, title: `Title ${externalId}`, text: "The gateway shall log.", source: "requirements-csv", ...extra };
}

function workItem(id: string, externalId: string): WorkItem {
  return { ...stamp, id, externalId, title: `Work ${externalId}`, source: "jira-csv" };
}

function testCase(id: string, name: string, extra: Partial<TestCase> = {}): TestCase {
  return { ...stamp, id, externalId: name, name, status: "passed", source: "junit-xml", ...extra };
}

function link(id: string, sourceType: TraceLink["sourceType"], sourceId: string, targetType: TraceLink["targetType"], targetId: string, linkType: TraceLink["linkType"] = "implements"): TraceLink {
  return { ...stamp, id, sourceType, sourceId, targetType, targetId, linkType, confidence: 1, source: "manual" };
}

function finding(id: string, entityType: Finding["entityType"], entityId: string): Finding {
  return { ...stamp, id, severity: "warning", category: "weak_wording", title: "Weak", description: "Weak", entityType, entityId };
}

function projectData(partial: Partial<ProjectData>): ProjectData {
  return {
    project: { id: "p1", name: "Falcon Telemetry Gateway", createdAt: stamp.createdAt, updatedAt: stamp.updatedAt },
    requirements: [],
    workItems: [],
    testCases: [],
    traceLinks: [],
    findings: [],
    importBatches: [],
    ...partial
  };
}

function node(id: string, type: TraceGraphNode["type"], extra: Partial<TraceGraphNode> = {}): TraceGraphNode {
  return { id, type, label: id, title: "", findingCount: 0, hasGap: false, orphan: false, ...extra };
}

function edge(source: string, target: string, kind: TraceGraphEdge["kind"]): TraceGraphEdge {
  return { id: `${source}->${target}`, source, target, label: kind === "requirement" ? "parent" : "implements", kind };
}

function rowOf(graphLayout: ReturnType<typeof layout>, id: string): number {
  return (graphLayout.positions.get(id)?.y ?? -1) / ROW_HEIGHT;
}

describe("traceGraphData", () => {
  const data = projectData({
    requirements: [
      requirement("r1", "REQ-001"),
      requirement("r2", "REQ 002/A", { parentExternalId: "REQ-001", status: "Approved" })
    ],
    workItems: [workItem("w1", "FTG-1"), workItem("w2", "FTG-2")],
    testCases: [testCase("t1", "test_status", { classname: "gateway.StatusTest", status: "failed" }), testCase("t2", "test_orphan")],
    traceLinks: [
      link("l1", "requirement", "r1", "workItem", "w1"),
      // Stored the other way around: the graph still puts the requirement first.
      link("l2", "testCase", "t1", "requirement", "r1", "verifies"),
      link("l3", "requirement", "r1", "requirement", "r2", "parent"),
      // Not drawn: a work item to test link, a dangling link, and a self link.
      link("l4", "workItem", "w2", "testCase", "t2", "references"),
      link("l5", "requirement", "r1", "workItem", "missing"),
      link("l6", "requirement", "r2", "requirement", "r2", "derived")
    ],
    findings: [finding("f1", "requirement", "r1"), finding("f2", "workItem", "w2"), finding("f3", "testCase", "t1")]
  });
  const graph = traceGraphData(data, "p1");

  it("builds requirement nodes with gap, finding, and link details", () => {
    const [first, second] = graph.nodes;
    expect(first).toMatchObject({
      id: "r1",
      type: "requirement",
      label: "REQ-001",
      title: "Title REQ-001",
      findingCount: 2,
      hasGap: false,
      orphan: false,
      href: "/projects/p1/requirements/REQ-001"
    });
    expect(second).toMatchObject({ id: "r2", status: "Approved", hasGap: true, findingCount: 0 });
    expect(second.href).toBe("/projects/p1/requirements/REQ%20002%2FA");
  });

  it("marks work items and tests with no requirement as orphans", () => {
    const byId = new Map(graph.nodes.map((item) => [item.id, item]));
    expect(byId.get("w1")).toMatchObject({ type: "workItem", orphan: false, findingCount: 0 });
    expect(byId.get("w2")).toMatchObject({ orphan: true, findingCount: 1 });
    expect(byId.get("t1")).toMatchObject({
      type: "testCase",
      label: "test_status",
      title: "gateway.StatusTest",
      status: "failed",
      orphan: false,
      findingCount: 1
    });
    expect(byId.get("t2")).toMatchObject({ title: "", orphan: true });
    expect(byId.get("r1")?.href).toBeDefined();
    expect(byId.get("w1")?.href).toBeUndefined();
  });

  it("keeps requirement-centered edges with the requirement as the source", () => {
    expect(graph.edges).toEqual([
      { id: "l1", source: "r1", target: "w1", label: "implements", kind: "work" },
      { id: "l2", source: "r1", target: "t1", label: "verifies", kind: "test" },
      { id: "l3", source: "r1", target: "r2", label: "parent", kind: "requirement" }
    ]);
  });
});

describe("layout", () => {
  it("places each requirement's work items and tests in its band", () => {
    const nodes = [
      node("r1", "requirement"),
      node("r2", "requirement"),
      node("r3", "requirement"),
      node("w1", "workItem"),
      node("w2", "workItem"),
      node("t1", "testCase"),
      node("t2", "testCase"),
      node("t3", "testCase"),
      node("t4", "testCase")
    ];
    const edges = [
      edge("r1", "w1", "work"),
      edge("r1", "t1", "test"),
      edge("r1", "t2", "test"),
      edge("r1", "t3", "test"),
      // Already placed with r1: stays there.
      edge("r2", "t1", "test"),
      edge("r2", "w2", "work"),
      edge("r3", "t4", "test")
    ];
    const result = layout(nodes, edges);

    expect(["r1", "w1", "t1", "t2", "t3"].map((id) => rowOf(result, id))).toEqual([0, 0, 0, 1, 2]);
    // r2 starts below r1's tallest column.
    expect(["r2", "w2"].map((id) => rowOf(result, id))).toEqual([3, 3]);
    expect(["r3", "t4"].map((id) => rowOf(result, id))).toEqual([4, 4]);
    expect(result.positions.get("w1")?.x).toBe(COLUMN_X.workItem);
    expect(result.positions.get("r1")?.x).toBe(COLUMN_X.requirement);
    expect(result.positions.get("t1")?.x).toBe(COLUMN_X.testCase);
    expect(result.rows).toBe(5);
    expect(result.height).toBe(4 * ROW_HEIGHT + NODE_HEIGHT);
    expect(result.width).toBe(GRAPH_WIDTH);
  });

  it("orders a band's items by node order, not edge order", () => {
    const nodes = [node("r1", "requirement"), node("t1", "testCase"), node("t2", "testCase")];
    const result = layout(nodes, [edge("r1", "t2", "test"), edge("r1", "t1", "test")]);
    expect([rowOf(result, "t1"), rowOf(result, "t2")]).toEqual([0, 1]);
  });

  it("puts orphan work items and tests after the last band", () => {
    const nodes = [
      node("w-orphan", "workItem"),
      node("r1", "requirement"),
      node("r2", "requirement"),
      node("w1", "workItem"),
      node("t-orphan-1", "testCase"),
      node("t-orphan-2", "testCase")
    ];
    const result = layout(nodes, [edge("r1", "w1", "work")]);
    expect(rowOf(result, "r1")).toBe(0);
    expect(rowOf(result, "w1")).toBe(0);
    expect(rowOf(result, "r2")).toBe(1);
    expect(rowOf(result, "w-orphan")).toBe(2);
    expect(rowOf(result, "t-orphan-1")).toBe(2);
    expect(rowOf(result, "t-orphan-2")).toBe(3);
  });

  it("ignores requirement-to-requirement links when assigning rows", () => {
    const nodes = [node("r1", "requirement"), node("r2", "requirement"), node("t1", "testCase")];
    const result = layout(nodes, [edge("r1", "r2", "requirement"), edge("r2", "t1", "test")]);
    expect([rowOf(result, "r1"), rowOf(result, "r2"), rowOf(result, "t1")]).toEqual([0, 1, 1]);
  });

  it("lays out a filtered subset from the top, treating links to hidden nodes as absent", () => {
    const graph: TraceGraphData = {
      nodes: [node("r1", "requirement"), node("r2", "requirement"), node("w1", "workItem"), node("t1", "testCase")],
      edges: [edge("r1", "w1", "work"), edge("r2", "w1", "work"), edge("r2", "t1", "test")]
    };
    const visible = subgraph(graph, neighborIds(new Set(["r2"]), graph.edges));
    expect(visible.nodes.map((item) => item.id)).toEqual(["r2", "w1", "t1"]);
    expect(visible.edges).toHaveLength(2);

    const result = layout(visible.nodes, visible.edges);
    expect([rowOf(result, "r2"), rowOf(result, "w1"), rowOf(result, "t1")]).toEqual([0, 0, 0]);
    expect(result.positions.has("r1")).toBe(false);
    expect(result.rows).toBe(1);
  });

  it("handles an empty graph", () => {
    expect(layout([], [])).toMatchObject({ rows: 0, height: 0 });
  });
});

describe("neighborIds and views", () => {
  const graph: TraceGraphData = {
    nodes: [
      node("r1", "requirement"),
      node("r2", "requirement", { hasGap: true }),
      node("r3", "requirement", { findingCount: 1 }),
      node("w1", "workItem"),
      node("w2", "workItem", { orphan: true }),
      node("t1", "testCase"),
      node("t2", "testCase")
    ],
    edges: [edge("r1", "w1", "work"), edge("r1", "t1", "test"), edge("r2", "t1", "test"), edge("r3", "t2", "test")]
  };

  it("adds nodes one edge away in either direction", () => {
    expect([...neighborIds(new Set(["t1"]), graph.edges)].sort()).toEqual(["r1", "r2", "t1"]);
    expect([...neighborIds(new Set(["r1"]), graph.edges)].sort()).toEqual(["r1", "t1", "w1"]);
  });

  it("shows everything in the all view", () => {
    expect(visibleNodeIds(graph, "all", "")).toBeNull();
    expect(subgraph(graph, null)).toBe(graph);
  });

  it("shows attention requirements, their links, and orphans in the attention view", () => {
    expect([...(visibleNodeIds(graph, "attention", "") ?? [])].sort()).toEqual(["r2", "r3", "t1", "t2", "w2"]);
  });

  it("shows a focused requirement and its links in any view", () => {
    expect([...(visibleNodeIds(graph, "attention", "r1") ?? [])].sort()).toEqual(["r1", "t1", "w1"]);
  });

  it("maps work items and tests to their first linked requirement in node order", () => {
    const first = firstLinkedRequirement({ nodes: graph.nodes, edges: [edge("r2", "t1", "test"), edge("r1", "t1", "test")] });
    expect(first.get("t1")).toBe("r1");
    expect(first.has("w2")).toBe(false);
  });

  it("opens large projects in the attention view", () => {
    const many = Array.from({ length: 301 }, (_, index) => node(`r${index}`, "requirement"));
    expect(defaultView(graph.nodes)).toBe("all");
    expect(defaultView(many)).toBe("all");
    const manyWithGap = [...many, node("gap", "requirement", { hasGap: true })];
    expect(defaultView(manyWithGap)).toBe("attention");
    expect(initialView(undefined, manyWithGap)).toBe("attention");
    expect(initialView("all", manyWithGap)).toBe("all");
  });

  it("falls back from the attention view when nothing needs attention", () => {
    expect(initialView("attention", graph.nodes)).toBe("attention");
    expect(initialView("attention", [node("r1", "requirement")])).toBe("all");
    expect(initialView("bogus", graph.nodes)).toBe("all");
  });
});

describe("viewport helpers", () => {
  it("starts wide canvases at the top of the columns, centered", () => {
    const viewport = topViewport({ width: 1200, height: 600 });
    expect(viewport.zoom).toBe(1);
    expect(viewport.y).toBe(24);
    expect(viewport.x).toBeCloseTo((1200 - GRAPH_WIDTH) / 2);
  });

  it("starts narrow canvases at a readable zoom on the requirements column", () => {
    const canvas = { width: 358, height: 590 };
    const viewport = topViewport(canvas);
    expect(viewport.zoom).toBe(NARROW_ZOOM);
    const columnCenter = (COLUMN_X.requirement + NODE_WIDTH.requirement / 2) * viewport.zoom + viewport.x;
    expect(columnCenter).toBeCloseTo(canvas.width / 2);
  });

  it("fits a small graph to the canvas", () => {
    const viewport = fitViewport({ width: GRAPH_WIDTH, height: 284 }, { width: 1200, height: 600 });
    expect(viewport.zoom).toBeCloseTo(1.1);
    expect(viewport.x).toBeCloseTo((1200 - GRAPH_WIDTH * viewport.zoom) / 2);
    expect(viewport.y).toBeCloseTo((600 - 284 * viewport.zoom) / 2);
  });

  it("fits the width at the top when fitting everything would be unreadable", () => {
    const viewport = fitViewport({ width: GRAPH_WIDTH, height: 5000 }, { width: 1200, height: 600 });
    expect(viewport.zoom).toBeGreaterThanOrEqual(MIN_READABLE_ZOOM);
    expect(viewport).toEqual(topViewport({ width: 1200, height: 600 }));
  });

  it("limits panning to the laid-out graph plus a margin", () => {
    const [[minX, minY], [maxX, maxY]] = panExtent({ width: GRAPH_WIDTH, height: 400 });
    expect(minX).toBeLessThan(0);
    expect(minY).toBeLessThan(0);
    expect(maxX).toBeGreaterThan(GRAPH_WIDTH);
    expect(maxY).toBeGreaterThan(400);
  });
});

describe("graphNotice", () => {
  function graphWith(counts: { requirements: number; workItems: number; tests: number }, edges: TraceGraphEdge[] = []) {
    return {
      nodes: [
        ...Array.from({ length: counts.requirements }, (_, index) => node(`r${index}`, "requirement")),
        ...Array.from({ length: counts.workItems }, (_, index) => node(`w${index}`, "workItem")),
        ...Array.from({ length: counts.tests }, (_, index) => node(`t${index}`, "testCase"))
      ],
      edges
    };
  }

  function text(notice: ReturnType<typeof graphNotice>): string {
    return (notice?.segments ?? []).map((segment) => (typeof segment === "string" ? segment : segment.text)).join("");
  }

  it("asks for requirements when only work items and tests exist", () => {
    const notice = graphNotice(graphWith({ requirements: 0, workItems: 3, tests: 2 }), "p1");
    expect(notice?.cause).toBe("no-requirements");
    expect(text(notice)).toBe("Import requirements to connect these 3 work items and 2 tests.");
    expect(notice?.segments[0]).toEqual({ text: "Import requirements", href: "/projects/p1/imports?type=requirements-csv" });
    expect(text(graphNotice(graphWith({ requirements: 0, workItems: 1, tests: 0 }), "p1"))).toBe(
      "Import requirements to connect this work item."
    );
  });

  it("asks for work items or tests when only requirements exist", () => {
    const notice = graphNotice(graphWith({ requirements: 4, workItems: 0, tests: 0 }), "p1");
    expect(notice?.cause).toBe("no-work-or-tests");
    expect(text(notice)).toBe(
      "Import a Jira CSV or JUnit XML file that mentions requirement IDs to connect work items and tests to these 4 requirements."
    );
    expect(notice?.segments).toContainEqual({ text: "JUnit XML", href: "/projects/p1/imports?type=junit-xml" });
  });

  it("points at the ID patterns when nothing matched", () => {
    const notice = graphNotice(graphWith({ requirements: 2, workItems: 3, tests: 1 }), "p1");
    expect(notice?.cause).toBe("no-links");
    expect(text(notice)).toBe(
      "None of the 3 work items or 1 test mention a requirement ID that matches your ID patterns. Check the ID patterns in Settings."
    );
    expect(notice?.segments).toContainEqual({ text: "Check the ID patterns in Settings", href: "/projects/p1/settings" });
  });

  it("stays quiet when the graph is empty or has requirement links", () => {
    expect(graphNotice(graphWith({ requirements: 0, workItems: 0, tests: 0 }), "p1")).toBeNull();
    expect(graphNotice(graphWith({ requirements: 1, workItems: 1, tests: 0 }, [edge("r0", "w0", "work")]), "p1")).toBeNull();
  });

  it("does not count parent links as requirement links", () => {
    const notice = graphNotice(graphWith({ requirements: 2, workItems: 1, tests: 0 }, [edge("r0", "r1", "requirement")]), "p1");
    expect(text(notice)).toBe(
      "The work item does not mention a requirement ID that matches your ID patterns. Check the ID patterns in Settings."
    );
  });
});
