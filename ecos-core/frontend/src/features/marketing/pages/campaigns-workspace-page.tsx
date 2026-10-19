import { useState } from 'react';
import { useCampaigns } from '../hooks/use-campaigns';
import { CampaignDrawer } from '../drawers/campaign-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_OBJECTIVE_LABELS,
  type CampaignStatus,
} from '../types/campaign';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';
import { ROUTES } from '@/router/routes';

const STATUS_OPTIONS: Array<{ value: CampaignStatus; label: string }> = [
  { value: 'ACTIVE',      label: 'Active' },
  { value: 'PAUSED',      label: 'Paused' },
  { value: 'ARCHIVED',    label: 'Archived' },
  { value: 'DELETED',     label: 'Deleted' },
  { value: 'WITH_ISSUES', label: 'With Issues' },
];

const STATUS_COLORS: Record<CampaignStatus, string> = {
  ACTIVE:      'bg-green-100 text-green-800',
  PAUSED:      'bg-yellow-100 text-yellow-800',
  DELETED:     'bg-red-100 text-red-800',
  ARCHIVED:    'bg-gray-100 text-gray-700',
  IN_PROCESS:  'bg-blue-100 text-blue-800',
  WITH_ISSUES: 'bg-orange-100 text-orange-800',
};

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

export function CampaignsWorkspacePage() {
  const navigate = useNavigate();
  const { money } = useFormatter();

  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('');
  const [objective,  setObjective]  = useState('');
  const [page,       setPage]       = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useCampaigns({
    search:    search || undefined,
    status:    status || undefined,
    objective: objective || undefined,
    per_page:  25,
    page,
  });

  const campaigns = data?.data ?? [];
  const meta      = data?.meta;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            {meta?.total ?? 0} campaigns across all connections
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(ROUTES.marketingCampaignDash)}
          >
            <TrendingUp className="size-4 mr-1.5" />
            Executive Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`size-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-52"
        />
        <Select
          value={status || 'all'}
          onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={objective || 'all'}
          onValueChange={(v) => { setObjective(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All objectives" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All objectives</SelectItem>
            {Object.entries(CAMPAIGN_OBJECTIVE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="text-start px-3 py-2 font-medium">Campaign</th>
              <th className="text-start px-3 py-2 font-medium">Status</th>
              <th className="text-start px-3 py-2 font-medium">Objective</th>
              <th className="text-end px-3 py-2 font-medium">Budget</th>
              <th className="text-end px-3 py-2 font-medium">Spend</th>
              <th className="text-end px-3 py-2 font-medium">Impressions</th>
              <th className="text-end px-3 py-2 font-medium">CTR</th>
              <th className="text-end px-3 py-2 font-medium">CPC</th>
              <th className="text-end px-3 py-2 font-medium">Purchases</th>
              <th className="text-end px-3 py-2 font-medium">Ad Sets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-4 bg-muted rounded w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">
                  No campaigns found. Connect a marketing account and run a sync to import campaigns.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedId(campaign.id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium truncate max-w-[240px]" title={campaign.name}>
                      {campaign.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {campaign.connector_type}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${STATUS_COLORS[campaign.status] ?? ''}`}
                    >
                      {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective ?? ''] ?? campaign.objective ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-end text-xs">{campaign.budget_display}</td>
                  <td className="px-3 py-2 text-end font-medium">
                    {campaign.latest_insight ? money(campaign.latest_insight.spend) : '—'}
                  </td>
                  <td className="px-3 py-2 text-end">
                    {fmtInt(campaign.latest_insight?.impressions)}
                  </td>
                  <td className="px-3 py-2 text-end">
                    {fmtPct(campaign.latest_insight?.ctr)}
                  </td>
                  <td className="px-3 py-2 text-end">
                    {campaign.latest_insight?.cpc != null ? money(campaign.latest_insight.cpc) : '—'}
                  </td>
                  <td className="px-3 py-2 text-end">
                    {fmtInt(campaign.latest_insight?.purchases)}
                  </td>
                  <td className="px-3 py-2 text-end text-muted-foreground">
                    {campaign.ad_sets_count ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Campaign Drawer */}
      <CampaignDrawer
        campaignId={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
