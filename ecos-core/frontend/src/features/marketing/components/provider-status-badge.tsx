import { useTranslation } from 'react-i18next';
import type { ProviderStatus } from '../types/provider-config';

const STATUS_CONFIG: Record<
  ProviderStatus,
  { dot: string; badge: string }
> = {
  not_configured:       { dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-600 border-gray-200' },
  invalid:              { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200' },
  invalid_configuration:{ dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200' },
  ready:                { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  connected:            { dot: 'bg-green-500',   badge: 'bg-green-50 text-green-700 border-green-200' },
  token_expired:        { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  permission_error:     { dot: 'bg-orange-500',  badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  webhook_missing:      { dot: 'bg-yellow-500',  badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  sync_disabled:        { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200' },
  service_unavailable:  { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600 border-red-200' },
  unknown:              { dot: 'bg-gray-300',    badge: 'bg-gray-50 text-gray-500 border-gray-200' },
};

interface Props {
  status: ProviderStatus;
  size?: 'sm' | 'md';
}

export function ProviderStatusBadge({ status, size = 'md' }: Props) {
  const { t } = useTranslation('marketing');
  const cfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_configured;
  const key  = STATUS_CONFIG[status] ? status : 'not_configured';
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${text} ${cfg.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {t($ => $.providers.status[key])}
    </span>
  );
}
