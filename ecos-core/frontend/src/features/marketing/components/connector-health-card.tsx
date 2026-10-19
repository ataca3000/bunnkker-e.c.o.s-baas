import { AlertCircle, CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useConnectorHealth } from '../hooks/use-marketing-connections';

interface Props {
  connectionId: string;
}

function StatusIndicator({ status }: { status: 'healthy' | 'warning' | 'error' }) {
  if (status === 'healthy') {
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  }
  if (status === 'warning') {
    return <AlertCircle className="w-4 h-4 text-amber-500" />;
  }
  return <WifiOff className="w-4 h-4 text-red-500" />;
}

function HealthBadge({ status }: { status: 'healthy' | 'warning' | 'error' }) {
  const { t } = useTranslation('marketing');
  const variants = {
    healthy: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error:   'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${variants[status]}`}>
      <StatusIndicator status={status} />
      {t($ => $.connections.health[status])}
    </span>
  );
}

export function ConnectorHealthCard({ connectionId }: Props) {
  const { t } = useTranslation('marketing');
  const { data, isLoading, refetch, isFetching } = useConnectorHealth(connectionId);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-3 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (!data) return null;

  const rows: Array<{ label: string; value: string | number | null }> = [
    { label: t($ => $.connections.healthCard.authStatus),     value: data.auth_status },
    { label: t($ => $.connections.healthCard.apiAvailable),   value: data.api_available ? t($ => $.common.yes) : t($ => $.common.no) },
    { label: t($ => $.connections.healthCard.tokenExpires),   value: data.token_expires_at ? new Date(data.token_expires_at).toLocaleDateString() : '—' },
    { label: t($ => $.connections.healthCard.lastSuccess),    value: data.last_successful_sync_at ? new Date(data.last_successful_sync_at).toLocaleString() : '—' },
    { label: t($ => $.connections.healthCard.lastFailure),    value: data.last_failed_sync_at ? new Date(data.last_failed_sync_at).toLocaleString() : '—' },
    { label: t($ => $.connections.healthCard.errors7d),       value: data.error_count },
    { label: t($ => $.connections.healthCard.avgSync),        value: data.avg_sync_duration_seconds ? `${data.avg_sync_duration_seconds}s` : '—' },
    { label: t($ => $.connections.healthCard.rateLimitLeft),  value: data.rate_limit_remaining ?? '—' },
  ];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t($ => $.connections.healthCard.title)}</span>
          <HealthBadge status={data.overall_status} />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium mt-0.5">{String(value ?? '—')}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
