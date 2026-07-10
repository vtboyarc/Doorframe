"use client";

import ReactFlow, { Background, Controls, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { testStatusColor } from "@/lib/severity";
import { panelClass } from "@/lib/ui";

type GraphNode = {
  id: string;
  type: string;
  label: string;
  title: string;
  status?: string;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

const columns: Record<string, number> = {
  requirement: 0,
  workItem: 360,
  testCase: 720
};

const colors: Record<string, string> = {
  requirement: "var(--accent-strong)",
  workItem: "var(--info)",
  testCase: "var(--warning)"
};

export function TraceGraphClient({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const counts: Record<string, number> = {};
  const flowNodes: Node[] = nodes.map((node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
    // Test nodes are colored by result so failures stand out; everything
    // else falls back to the per-type color.
    const statusColor = node.type === "testCase" && node.status ? testStatusColor(node.status) : null;
    const color = statusColor ?? colors[node.type] ?? "var(--muted)";
    const failing = node.status === "failed" || node.status === "errored";
    return {
      id: node.id,
      position: {
        x: columns[node.type] ?? 0,
        y: counts[node.type] * 92
      },
      data: {
        label: (
          <div>
            <div className="text-xs uppercase">{node.type}</div>
            <div className="font-semibold">{node.label}</div>
            <div className="max-w-[180px] truncate text-xs">{node.title}</div>
          </div>
        )
      },
      style: {
        border: `${failing ? 2 : 1}px solid ${color}`,
        background: "var(--panel-strong)",
        borderRadius: 4,
        color: "var(--foreground)",
        width: 220
      }
    };
  });
  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: false
  }));

  return (
    <div className={`h-[680px] ${panelClass}`}>
      <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
