import { useState } from 'react';
import { useMarketingAssets } from '../hooks/use-marketing-assets';
import { AssetHealthBadge } from '../components/asset-health-badge';
import { ConnectorIcon } from '../components/connector-icon';
import { AssetDetailDrawer } from '../drawers/asset-detail-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ASSET_TYPE_LABELS,
  type AssetHealth,
  type AssetType,
} from '../types/marketing';

const ASSET_TYPES: Array<{ value: AssetType; label: string }> = (
  Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]
).map(([value, label]) => ({ value, label }));

const HEALTH_OPTIONS: Array<{ value: AssetHealth; label: string }> = [
  { value: 'healthy',            label: 'Healthy' },
  { value: 'warning',            label: 'Warning' },
  { value: 'disconnected',       label: 'Disconnected' },
  { value: 'expired_token',      label: 'Token Expired' },
  { value: 'permission_missing', label: 'Missing Permission' },
  { value: 'sync_failed',        label: 'Sync Failed' },
  { value: 'inactive',           label: 'Inactive' },
];

export function MarketingAssetsPage() {
  const [search,      setSearch]      = useState('');
  const [assetType,   setAssetType]   = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<string>('');
  const [page,        setPage]        = useState(1);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);

  const { data, isLoading } = useMarketingAssets({
    search:       search || undefined,
    asset_type:   assetType || undefined,
    health_status: healthFilter || undefined,
    per_page:     50,
    page,
  });

  const assets = data?.data ?? [];
  const meta   = data?.meta;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Marketing Assets</h1>
        <p className="text-sm text-muted-foreground">
          {meta?.total ?? 0} assets
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search assets…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-52"
        />
        <Select
          value={assetType || 'all'}
          onValueChange={(v) => { setAssetType(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ASSET_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={healthFilter || 'all'}
          onValueChange={(v) => { setHealthFilter(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health</SelectItem>
            {HEALTH_OPTIONS.map((h) => (
              <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || assetType || healthFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setAssetType(''); setHealthFilter(''); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Loading…</div>
      ) : assets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          No assets found. Trigger a sync to discover assets.
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">Asset</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">Platform</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">Health</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">Mappings</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedId(asset.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-[220px]">{asset.name}</div>
                    <div className="text-xs text-muted-foreground">{asset.external_id}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ASSET_TYPE_LABELS[asset.asset_type]}
                  </td>
                  <td className="px-4 py-3">
                    <ConnectorIcon connector={asset.connector_type} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <AssetHealthBadge health={asset.health_status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {asset.relationships_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {asset.last_synced_at
                      ? new Date(asset.last_synced_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {meta.page} of {meta.last_page}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => setPage(meta.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.last_page}
              onClick={() => setPage(meta.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <AssetDetailDrawer
        assetId={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
