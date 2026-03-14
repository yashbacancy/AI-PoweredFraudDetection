"use client";

import { useMemo, useState } from "react";
import type { GraphEdgeRow } from "@/lib/local/management-repository";

type GraphNode = {
  id: string;
  type: string;
  value: string;
  degree: number;
  x: number;
  y: number;
};

const NODE_COLORS: Record<string, string> = {
  user: "#58A6FF",
  device: "#F97316",
  ip: "#F78166",
  payment_method: "#D2A8FF",
  merchant: "#3FB950",
  country: "#D29922",
};

function nodeColor(type: string) {
  return NODE_COLORS[type] ?? "#8B949E";
}

function layoutCircle(nodes: Omit<GraphNode, "x" | "y">[], cx: number, cy: number, r: number): GraphNode[] {
  const n = nodes.length;
  if (n === 0) return [];
  if (n === 1) return [{ ...nodes[0], x: cx, y: cy }];
  return nodes.map((node, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const rr = r * (1 - Math.min(node.degree, 6) / 14);
    return { ...node, x: cx + rr * Math.cos(angle), y: cy + rr * Math.sin(angle) };
  });
}

export function GraphCanvas({ edges }: { edges: GraphEdgeRow[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const { positioned, nodeMap } = useMemo(() => {
    const nodeSet = new Map<string, Omit<GraphNode, "x" | "y">>();
    for (const edge of edges) {
      const srcId = `${edge.source_type}:${edge.source_value}`;
      const tgtId = `${edge.target_type}:${edge.target_value}`;
      if (!nodeSet.has(srcId)) nodeSet.set(srcId, { id: srcId, type: edge.source_type, value: edge.source_value, degree: 0 });
      if (!nodeSet.has(tgtId)) nodeSet.set(tgtId, { id: tgtId, type: edge.target_type, value: edge.target_value, degree: 0 });
      nodeSet.get(srcId)!.degree += 1;
      nodeSet.get(tgtId)!.degree += 1;
    }
    const positioned = layoutCircle([...nodeSet.values()], 490, 220, 170);
    const nodeMap = new Map(positioned.map((n) => [n.id, n]));
    return { positioned, nodeMap };
  }, [edges]);

  const relatedIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const ids = new Set<string>();
    for (const e of edges) {
      const s = `${e.source_type}:${e.source_value}`;
      const t = `${e.target_type}:${e.target_value}`;
      if (s === selected) ids.add(t);
      if (t === selected) ids.add(s);
    }
    return ids;
  }, [selected, edges]);

  if (edges.length === 0) {
    return (
      <div className="graph-empty">
        <p>No graph edges have been generated yet.</p>
        <p>Create transactions to start building the entity relationship graph.</p>
      </div>
    );
  }

  return (
    <div className="graph-canvas-wrap">
      <svg viewBox="0 0 980 440" className="graph-svg" aria-label="Fraud entity relationship graph">
        {/* Edges */}
        {edges.map((edge) => {
          const src = nodeMap.get(`${edge.source_type}:${edge.source_value}`);
          const tgt = nodeMap.get(`${edge.target_type}:${edge.target_value}`);
          if (!src || !tgt) return null;
          const srcId = src.id;
          const tgtId = tgt.id;
          const highlighted = selected && (srcId === selected || tgtId === selected);
          const dimmed = selected && !highlighted;
          return (
            <line
              key={edge.id}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke={highlighted ? "#58A6FF" : "#30363D"}
              strokeWidth={highlighted ? Math.max(1, edge.weight * 1.5) : Math.max(0.5, edge.weight * 0.8)}
              strokeOpacity={dimmed ? 0.1 : highlighted ? 0.85 : 0.45}
            />
          );
        })}

        {/* Nodes */}
        {positioned.map((node) => {
          const isSelected = node.id === selected;
          const isRelated = relatedIds.has(node.id);
          const dimmed = selected && !isSelected && !isRelated;
          const r = 7 + Math.min(node.degree, 6) * 2;
          const color = nodeColor(node.type);
          const label = node.value.length > 16 ? `${node.value.slice(0, 14)}…` : node.value;

          return (
            <g
              key={node.id}
              onClick={() => setSelected(isSelected ? null : node.id)}
              style={{ cursor: "pointer", opacity: dimmed ? 0.2 : 1 }}
              role="button"
              aria-label={`${node.type}: ${node.value}`}
            >
              {isSelected && (
                <circle cx={node.x} cy={node.y} r={r + 10} fill={color} fillOpacity={0.12} />
              )}
              {isRelated && !isSelected && (
                <circle cx={node.x} cy={node.y} r={r + 6} fill={color} fillOpacity={0.08} />
              )}
              <circle cx={node.x} cy={node.y} r={r} fill={color} stroke={isSelected ? "#fff" : "transparent"} strokeWidth={1.5} />
              <text
                x={node.x}
                y={node.y + r + 13}
                textAnchor="middle"
                fontSize="9"
                fill={dimmed ? "#484f58" : "#8B949E"}
                fontFamily="ui-monospace,monospace"
              >
                {label}
              </text>
              <text
                x={node.x}
                y={node.y + r + 23}
                textAnchor="middle"
                fontSize="8"
                fill={dimmed ? "#30363D" : color}
                fontFamily="ui-monospace,monospace"
                opacity={0.7}
              >
                {node.type}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="graph-legend">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} className="graph-legend-item">
            <span className="graph-legend-dot" style={{ background: color }} />
            {type.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {selected && (
        <div className="graph-selection-info">
          <span>
            <strong>{selected}</strong>
            {" · "}
            {relatedIds.size} connection{relatedIds.size !== 1 ? "s" : ""}
          </span>
          <button className="graph-clear-btn" onClick={() => setSelected(null)}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
