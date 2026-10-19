import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface DataPoint {
  label: string;
  value: number | null;
}

interface LineChartProps {
  data:          DataPoint[];
  color?:        string;
  height?:       number;
  showLabels?:   boolean;
  showGrid?:     boolean;
  className?:    string;
  formatValue?:  (v: number) => string;
}

export function LineChart({
  data,
  color = '#3B82F6',
  height = 160,
  showLabels = true,
  showGrid = true,
  className,
}: LineChartProps) {
  const { t } = useTranslation('marketing');
  const points = data.filter((d) => d.value != null) as Array<{ label: string; value: number }>;

  const { path, areaPath, coords } = useMemo(() => {
    if (points.length < 2) return { path: '', areaPath: '', minY: 0, maxY: 0, coords: [] };

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const padX = 4;
    const padY = 12;
    const W = 100; // viewBox width in %
    const H = height;
    const usableW = W - padX * 2;
    const usableH = H - padY * 2;

    const toX = (i: number) => padX + (i / (points.length - 1)) * usableW;
    const toY = (v: number) => padY + usableH - ((v - min) / range) * usableH;

    const coords = points.map((p, i) => ({ x: toX(i), y: toY(p.value), label: p.label, value: p.value }));

    const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
    const areaPath = `${path} L${coords[coords.length - 1].x},${H - padY} L${coords[0].x},${H - padY} Z`;

    return { path, areaPath, minY: min, maxY: max, coords };
  }, [points, height]);

  if (points.length < 2) {
    return (
      <div className={cn('flex items-center justify-center text-sm text-muted-foreground', className)}
        style={{ height }}>
        {t($ => $.common.noData)}
      </div>
    );
  }

  const labelStep = Math.ceil(points.length / 6);

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        role="img"
        aria-label={t($ => $.intelligence.chart.lineChartAria)}
      >
        {/* Grid lines */}
        {showGrid && [0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1="4" x2="96"
            y1={12 + (1 - t) * (height - 24)}
            y2={12 + (1 - t) * (height - 24)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="0.5"
          />
        ))}

        {/* Area fill */}
        <defs>
          <linearGradient id={`area-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#area-grad-${color.replace('#', '')})`} />

        {/* Line */}
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots at first/last */}
        {[coords[0], coords[coords.length - 1]].map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill={color} />
        ))}
      </svg>

      {/* X-axis labels */}
      {showLabels && points.length > 0 && (
        <div className="flex justify-between px-1 mt-1">
          {points.map((p, i) => (
            i % labelStep === 0 || i === points.length - 1 ? (
              <span key={i} className="text-[10px] text-muted-foreground leading-none">
                {p.label}
              </span>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}
