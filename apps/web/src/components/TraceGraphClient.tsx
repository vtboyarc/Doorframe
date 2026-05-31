"use client";

import ReactFlow, { Background, Controls, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";

type GraphNode = {
  id: string;
  type: string;
  label: string;
  title: string;
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
  requirement: "#176c5f",
  workItem: "#44546a",
  testCase: "#6f4e1d"
};

export function TraceGraphClient({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const counts: Record<string, number> = {};
  const flowNodes: Node[] = nodes.map((node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
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
        border: `1px solid ${colors[node.type] ?? "#333"}`,
        borderRadius: 4,
        color: colors[node.type] ?? "#333",
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
    <div className="h-[680px] border border-[var(--line)] bg-white">
      <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
