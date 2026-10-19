import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ConnectionStatus } from '@/features/channels/types/channel';

type Config = { label: string; dot: string };

const STATUS_CONFIG: Record<ConnectionStatus, Config> = {
  disconnected: { label: 'Disconnected', dot: 'bg-gray-400' },
  connected: { label: 'Connected', dot: 'bg-emerald-500' },
  error: { label: 'Error', dot: 'bg-rose-500' },
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-gray-400' };

  return (
    <Badge variant="secondary" className="gap-1.5 whitespace-nowrap">
      <span className={cn('size-1.5 rounded-full', config.dot)} />
      {config.label}
    </Badge>
  );
}
