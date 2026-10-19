import type { FindingSeverity } from '../types/engineering';

const CONFIG: Record<FindingSeverity, { label: string; className: string }> = {
  CRITICAL: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  HIGH:     { label: 'High',     className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  MEDIUM:   { label: 'Medium',   className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  LOW:      { label: 'Low',      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  const cfg = CONFIG[severity] ?? CONFIG.LOW;
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
