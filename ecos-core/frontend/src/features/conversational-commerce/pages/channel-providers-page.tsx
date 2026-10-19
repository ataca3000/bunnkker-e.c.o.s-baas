import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { useChannelProviders, useActivateChannelProvider, useDeleteChannelProvider } from '../hooks/use-channel-providers';
import type { ChannelProvider, CommunicationProvider } from '../types/conversation';

const PROVIDER_LABELS: Record<CommunicationProvider, string> = {
  whatsapp: 'WhatsApp Business',
  messenger: 'Facebook Messenger',
  instagram_direct: 'Instagram Direct',
  email: 'Email',
  sms: 'SMS',
};

function ProviderStatusIcon({ status }: { status: ChannelProvider['status'] }) {
  if (status === 'active') return <Wifi className="w-4 h-4 text-green-500" />;
  if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
  return <WifiOff className="w-4 h-4 text-muted-foreground" />;
}

export function ChannelProvidersPage() {
  const { data, isLoading } = useChannelProviders();
  const providers = data?.data ?? [];
  const activate = useActivateChannelProvider();
  const remove = useDeleteChannelProvider();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Channel Providers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure WhatsApp, Messenger, and Instagram connections
          </p>
        </div>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Provider
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Wifi className="w-10 h-10" />
          <p className="font-medium">No providers connected</p>
          <p className="text-sm">Add your first channel to start receiving messages</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {providers.map((p) => (
            <div key={p.id} className="border rounded-lg p-4 flex items-center gap-4">
              <ProviderStatusIcon status={p.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">
                    {PROVIDER_LABELS[p.channel] ?? p.channel}
                  </span>
                  <Badge
                    variant={p.status === 'active' ? 'default' : p.status === 'error' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {p.status}
                  </Badge>
                </div>
                {p.phone_number && (
                  <p className="text-xs text-muted-foreground">{p.phone_number}</p>
                )}
                {p.last_error && (
                  <p className="text-xs text-destructive mt-1 truncate">{p.last_error}</p>
                )}
                {p.last_verified_at && (
                  <p className="text-xs text-muted-foreground">
                    Last verified: {new Date(p.last_verified_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {p.status !== 'active' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activate.mutate(p.id)}
                    disabled={activate.isPending}
                  >
                    Activate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove.mutate(p.id)}
                  disabled={remove.isPending}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
