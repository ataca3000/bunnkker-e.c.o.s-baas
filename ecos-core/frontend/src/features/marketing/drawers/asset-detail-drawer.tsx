import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ds/use-toast';
import {
  useMarketingAsset,
  useAssetRelationships,
  useAcceptSuggestion,
  useRejectSuggestion,
  useCheckAssetHealth,
} from '../hooks/use-marketing-assets';
import { AssetHealthBadge } from '../components/asset-health-badge';
import { ConnectorIcon } from '../components/connector-icon';
import { ConnectorHealthCard } from '../components/connector-health-card';
import { RelationshipGraph } from '../components/relationship-graph';
import { ASSET_TYPE_LABELS } from '../types/marketing';

interface Props {
  assetId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AssetDetailDrawer({ assetId, open, onClose }: Props) {
  const { data: asset, isLoading } = useMarketingAsset(assetId ?? undefined);
  const { data: relationships = [] }  = useAssetRelationships(assetId ?? undefined);
  const accept      = useAcceptSuggestion();
  const reject      = useRejectSuggestion();
  const checkHealth = useCheckAssetHealth();
  const { toast }   = useToast();

  function handleAccept(relId: string) {
    accept.mutate(relId, {
      onSuccess: () => toast({ title: 'Mapping accepted' }),
    });
  }

  function handleReject(relId: string) {
    reject.mutate(relId, {
      onSuccess: () => toast({ title: 'Mapping rejected' }),
    });
  }

  function handleCheckHealth() {
    if (!assetId) return;
    checkHealth.mutate(assetId, {
      onSuccess: (res) =>
        toast({ title: `Health: ${res.data.health_status}` }),
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        {isLoading || !asset ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            Loading…
          </div>
        ) : (
          <>
            <SheetHeader className="mb-4">
              <div className="flex items-center gap-3">
                <ConnectorIcon connector={asset.connector_type} size="lg" />
                <div>
                  <SheetTitle className="text-base">{asset.name}</SheetTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type} · {asset.external_id}
                  </p>
                </div>
              </div>
            </SheetHeader>

            {/* Health row */}
            <div className="flex items-center gap-2 mb-4">
              <AssetHealthBadge health={asset.health_status} />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckHealth}
                disabled={checkHealth.isPending}
              >
                {checkHealth.isPending ? 'Checking…' : 'Refresh Health'}
              </Button>
            </div>

            <Tabs defaultValue="details">
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="mappings">
                  Mappings
                  {relationships.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5">
                      {relationships.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="graph">Graph</TabsTrigger>
                <TabsTrigger value="connector">Connector</TabsTrigger>
                <TabsTrigger value="metadata">Raw</TabsTrigger>
              </TabsList>

              {/* ── Details tab ── */}
              <TabsContent value="details">
                <dl className="space-y-3 text-sm">
                  {(
                    [
                      ['Connector',   asset.connector_type],
                      ['Type',        ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type],
                      ['Status',      asset.status],
                      ['Last synced', asset.last_synced_at ?? '—'],
                      ['Next sync',   asset.next_sync_at ?? '—'],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label} className="flex gap-2">
                      <dt className="w-28 text-muted-foreground shrink-0">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </TabsContent>

              {/* ── Mappings tab ── */}
              <TabsContent value="mappings">
                {relationships.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No mappings yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {relationships.map((rel) => (
                      <li
                        key={rel.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium">{rel.related_type}</span>
                          <span className="text-muted-foreground ml-1">
                            #{rel.related_id.slice(0, 8)}
                          </span>
                          {rel.is_auto_suggested && !rel.accepted_at && !rel.rejected_at && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Suggestion
                            </Badge>
                          )}
                          {rel.accepted_at && (
                            <Badge variant="secondary" className="ml-2 text-xs text-green-700">
                              Accepted
                            </Badge>
                          )}
                          {rel.rejected_at && (
                            <Badge variant="secondary" className="ml-2 text-xs text-red-700">
                              Rejected
                            </Badge>
                          )}
                        </div>
                        {rel.is_auto_suggested && !rel.accepted_at && !rel.rejected_at && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAccept(rel.id)}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReject(rel.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              {/* ── Graph tab (Part 8) ── */}
              <TabsContent value="graph">
                {assetId && <RelationshipGraph assetId={assetId} />}
              </TabsContent>

              {/* ── Connector health tab (Part 5) ── */}
              <TabsContent value="connector">
                {asset.marketing_connection_id && (
                  <ConnectorHealthCard connectionId={asset.marketing_connection_id} />
                )}
              </TabsContent>

              {/* ── Raw Metadata tab ── */}
              <TabsContent value="metadata">
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-80 whitespace-pre-wrap">
                  {JSON.stringify(asset.asset_metadata, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
