import type { ScoreTrendPoint } from '../types/engineering';

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
  height?: number;
}

export function ScoreTrendChart({ data, height = 80 }: ScoreTrendChartProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        Not enough data for trend
      </div>
    );
  }

  const width = 400;
  const padding = { top: 8, right: 8, bottom: 16, left: 28 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const minScore = Math.max(0, Math.min(...data.map((d) => d.score)) - 5);
  const maxScore = Math.min(100, Math.max(...data.map((d) => d.score)) + 5);
  const range = maxScore - minScore || 1;

  const toX = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const toY = (score: number) => padding.top + chartH - ((score - minScore) / range) * chartH;

  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(d.score).toFixed(1)}`)
    .join(' ');

  const areaD =
    `${pathD} L ${toX(data.length - 1).toFixed(1)} ${(padding.top + chartH).toFixed(1)} ` +
    `L ${padding.left.toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ height, overflow: 'visible' }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="eng-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* 80-point reference line */}
      {maxScore >= 80 && minScore <= 80 && (
        <line
          x1={padding.left} y1={toY(80)}
          x2={padding.left + chartW} y2={toY(80)}
          stroke="#22c55e" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.5"
        />
      )}

      {/* Area fill */}
      <path d={areaD} fill="url(#eng-trend-fill)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Dots for release_ready = true */}
      {data.map((d, i) =>
        d.release_ready ? (
          <circle
            key={i}
            cx={toX(i)} cy={toY(d.score)}
            r="3" fill="#22c55e" stroke="white" strokeWidth="1"
          />
        ) : null,
      )}

      {/* Y axis labels */}
      {[minScore, 80, maxScore].map((v) => {
        if (v < minScore || v > maxScore) return null;
        return (
          <text
            key={v}
            x={padding.left - 4}
            y={toY(v)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="8"
            fill="currentColor"
            opacity="0.5"
          >
            {Math.round(v)}
          </text>
        );
      })}
    </svg>
  );
}
