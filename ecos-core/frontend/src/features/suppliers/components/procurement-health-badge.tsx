import type { ProcurementHealth } from '../types/supplier';

const CONFIG: Record<ProcurementHealth, { label: string; className: string }> = {
  excellent: { label: 'Excellent', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  good:      { label: 'Good',      className: 'bg-blue-50 text-blue-700 border-blue-200' },
  watch:     { label: 'Watch',     className: 'bg-amber-50 text-amber-700 border-amber-200' },
  risk:      { label: 'Risk',      className: 'bg-orange-50 text-orange-700 border-orange-200' },
  critical:  { label: 'Critical',  className: 'bg-red-50 text-red-700 border-red-200' },
};

type Props = { score?: ProcurementHealth | null };

export function ProcurementHealthBadge({ score }: Props) {
  if (!score) return <span className="text-xs text-muted-foreground">—</span>;
  const { label, className } = CONFIG[score];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
