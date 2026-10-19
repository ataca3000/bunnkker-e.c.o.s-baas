import type { RepairSessionStatus } from '../../types/engineering';

/**
 * Status colours for repair sessions.
 *
 * Kept in its own module rather than beside the drawer component. A file that
 * exports both a component and a constant cannot be hot-reloaded — Fast Refresh
 * bails out and the whole module graph reloads instead, which in this project
 * has already cost a dev-server restart to recover from.
 */
export const REPAIR_STATUS_COLORS: Record<RepairSessionStatus, string> = {
  pending: 'bg-gray-400',
  analyzing: 'bg-blue-500',
  generating_prompt: 'bg-blue-500',
  awaiting_response: 'bg-yellow-500',
  applying: 'bg-blue-600',
  completed: 'bg-green-600',
  failed: 'bg-red-600',
  cancelled: 'bg-gray-500',
  retrying: 'bg-orange-500',
  timeout: 'bg-red-500',
};

/** The colour for a status, falling back rather than rendering an unstyled dot. */
export function repairStatusColor(status: string): string {
  return REPAIR_STATUS_COLORS[status as RepairSessionStatus] ?? 'bg-gray-400';
}
