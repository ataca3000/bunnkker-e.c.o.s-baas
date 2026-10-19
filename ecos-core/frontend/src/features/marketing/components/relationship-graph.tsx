import { useMemo } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAssetRelationshipGraph } from '../hooks/use-marketing-assets';
import type { GraphEdge, GraphNode } from '../types/marketing';

interface Props {
  assetId: string;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const CX = 260;   // center X of SVG canvas
const CY = 140;   // center Y of SVG canvas
const R  = 110;   // radius of satellite nodes

const NODE_W  = 120;
const NODE_H  = 44;
const NODE_RX = 8;

// ── Colour map by node type ───────────────────────────────────────────────────

const TYPE_COLOUR: Record<string, { fill: string; stroke: string; text: string }> = {
  asset:   { fill: '#eff6ff', stroke: '#3b82f6', text: '#1d4ed8' },
  brand:   { fill: '#fdf4ff', stroke: '#a855f7', text: '#7e22ce' },
  channel: { fill: '#f0fdf4', stroke: '#22c55e', text: '#15803d' },
  product: { fill: '#fff7ed', stroke: '#f97316', text: '#c2410c' },
};

function colourFor(type: string) {
  return TYPE_COLOUR[type] ?? { fill: '#f8fafc', stroke: '#94a3b8', text: '#334155' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GraphNodeEl({ node, x, y }: { node: GraphNode; x: number; y: number }) {
  const { fill, stroke, text } = colourFor(node.type);
  const label = node.label.length > 14 ? node.label.slice(0, 13) + '…' : node.label;
  const sub   = node.sub_label ?? node.type;

  return (
    <g transform={`translate(${x - NODE_W / 2}, ${y - NODE_H / 2})`}>
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={NODE_RX}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={NODE_W / 2}
        y={16}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={text}
      >
        {label}
      </text>
      <text
        x={NODE_W / 2}
        y={32}
        textAnchor="middle"
        fontSize={9}
        fill="#64748b"
      >
        {sub}
      </text>
    </g>
  );
}

function EdgeEl({
  edge,
  positions,
}: {
  edge: GraphEdge;
  positions: Map<string, { x: number; y: number }>;
}) {
  const src = positions.get(edge.source);
  const tgt = positions.get(edge.target);
  if (!src || !tgt) return null;

  const colour = edge.accepted ? '#22c55e' : edge.auto_suggested ? '#f97316' : '#94a3b8';
  const dash   = edge.accepted ? 'none' : '5,3';

  const mx = (src.x + tgt.x) / 2;
  const my = (src.y + tgt.y) / 2;

  const conf = edge.confidence != null ? `${edge.confidence}%` : null;

  return (
    <g>
      <line
        x1={src.x} y1={src.y}
        x2={tgt.x} y2={tgt.y}
        stroke={colour}
        strokeWidth={1.5}
        strokeDasharray={dash}
        markerEnd="url(#arrow)"
      />
      {conf && (
        <text x={mx} y={my - 4} textAnchor="middle" fontSize={8} fill={colour}>
          {conf}
        </text>
      )}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RelationshipGraph({ assetId }: Props) {
  const { t } = useTranslation('marketing');
  const { data, isLoading, isError } = useAssetRelationshipGraph(assetId);

  const positions = useMemo<Map<string, { x: number; y: number }>>(() => {
    if (!data) return new Map();

    const map = new Map<string, { x: number; y: number }>();
    const assetNodeId = `asset:${assetId}`;

    // Central node
    map.set(assetNodeId, { x: CX, y: CY });

    // Satellite nodes arranged in a circle
    const satellites = data.nodes.filter((n) => n.id !== assetNodeId);
    satellites.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(satellites.length, 1) - Math.PI / 2;
      map.set(node.id, {
        x: CX + R * Math.cos(angle),
        y: CY + R * Math.sin(angle),
      });
    });

    return map;
  }, [data, assetId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{t($ => $.assets.graph.loading)}</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{t($ => $.assets.graph.loadError)}</span>
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t($ => $.assets.graph.empty)}
      </p>
    );
  }

  // Dynamic SVG height so satellites don't clip
  const svgH = Math.max(300, CY + R + NODE_H + 20);

  return (
    <div className="w-full overflow-x-auto rounded-md border bg-background p-2">
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 520 ${svgH}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label={t($ => $.assets.graph.aria)}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {data.edges.map((edge) => (
          <EdgeEl key={edge.id} edge={edge} positions={positions} />
        ))}

        {/* Nodes */}
        {data.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          return <GraphNodeEl key={node.id} node={node} x={pos.x} y={pos.y} />;
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 border-t-2 border-green-500" />
          {t($ => $.assets.graph.legendAccepted)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-6 border-t-2 border-dashed border-orange-400" />
          {t($ => $.assets.graph.legendSuggested)}
        </span>
      </div>
    </div>
  );
}
