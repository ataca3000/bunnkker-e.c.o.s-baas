import { useState } from 'react';
import { Plus, Search, RefreshCw, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCampaignDrafts, useStudioKpis, useDeleteCampaignDraft, useDuplicateCampaignDraft } from '../hooks/use-campaign-studio';
import { CampaignDraftDrawer } from '../drawers/campaign-draft-drawer';
import type { CampaignDraft, CampaignInternalStatus, DraftFilters } from '../types/campaign-studio';
import { useMarketingLabels, CAMPAIGN_INTERNAL_STATUS_COLORS } from '@/features/marketing/hooks/use-marketing-labels';

export function CampaignStudioPage() {
  const { internalStatusTabLabel } = useMarketingLabels();
  const [activeTab, setActiveTab]     = useState<CampaignInternalStatus | 'all'>('all');
  const [search, setSearch]           = useState('');
  const [selectedDraft, setSelected]  = useState<CampaignDraft | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [creating, setCreating]       = useState(false);

  const filters: DraftFilters = {
    search:  search || undefined,
    status:  activeTab !== 'all' ? activeTab : undefined,
    per_page: 50,
  };

  const { data, isLoading, refetch } = useCampaignDrafts(filters);
  const { data: kpis }               = useStudioKpis();
  const deleteDraft                  = useDeleteCampaignDraft();
  const duplicateDraft               = useDuplicateCampaignDraft();

  const drafts = data?.data ?? [];

  function openDraft(draft: CampaignDraft) {
    setSelected(draft);
    setCreating(false);
    setDrawerOpen(true);
  }

  function openCreate() {
    setSelected(null);
    setCreating(true);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Campaign Studio</h1>
            <p className="text-xs text-muted-foreground">Create and manage campaigns across all advertising providers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4 mr-1" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      {kpis && (
        <div className="border-b px-6 py-3 flex items-center gap-6 text-sm shrink-0 overflow-x-auto">
          <KpiChip label="Drafts"    value={kpis.drafts} />
          <KpiChip label="Pending"   value={kpis.pending_review} color="text-yellow-600" />
          <KpiChip label="Scheduled" value={kpis.scheduled}      color="text-purple-600" />
          <KpiChip label="Active"    value={kpis.active}         color="text-green-600" />
          <KpiChip label="Paused"    value={kpis.paused}         color="text-orange-600" />
          <KpiChip label="Failed"    value={kpis.failed}         color="text-red-600" />
          <KpiChip label="Published Today" value={kpis.published_today} color="text-green-700" />
        </div>
      )}

      {/* Status Tabs */}
      <div className="border-b px-6 flex gap-1 shrink-0 overflow-x-auto">
        {(['all', 'draft', 'pending_review', 'approved', 'scheduled', 'published', 'paused', 'archived', 'failed'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`px-3 py-2.5 text-sm border-b-2 whitespace-nowrap transition-colors ${
              activeTab === value
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {internalStatusTabLabel[value] ?? value}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Drafts Grid */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-lg border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <Layers className="size-10 opacity-30" />
            <p className="text-sm">No campaigns found.</p>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="size-3.5 mr-1" /> Create your first campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {drafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onOpen={() => openDraft(draft)}
                onDuplicate={() => duplicateDraft.mutate(draft.id)}
                onDelete={() => deleteDraft.mutate(draft.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      <CampaignDraftDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        draft={selectedDraft}
        creating={creating}
      />
    </div>
  );
}

function KpiChip({ label, value, color = 'text-foreground' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className={`text-base font-semibold ${color}`}>{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function DraftCard({ draft, onOpen, onDuplicate, onDelete }: {
  draft: CampaignDraft;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { internalStatusLabel } = useMarketingLabels();
  return (
    <div className="border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer group" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="font-medium text-sm leading-tight line-clamp-2">{draft.name}</p>
        <Badge className={`shrink-0 text-xs ${CAMPAIGN_INTERNAL_STATUS_COLORS[draft.internal_status]}`}>
          {internalStatusLabel[draft.internal_status]}
        </Badge>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground mb-3">
        {draft.connector_type && <p>Provider: <span className="text-foreground capitalize">{draft.connector_type}</span></p>}
        {draft.objective      && <p>Objective: <span className="text-foreground">{draft.objective}</span></p>}
        {draft.daily_budget   && <p>Budget: <span className="text-foreground">${parseFloat(draft.daily_budget).toLocaleString()}/day</span></p>}
        {draft.start_date     && <p>Starts: <span className="text-foreground">{new Date(draft.start_date).toLocaleDateString()}</span></p>}
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onDuplicate}>Duplicate</button>
        {draft.is_editable && (
          <button className="text-xs text-red-500 hover:text-red-700 ms-auto" onClick={onDelete}>Delete</button>
        )}
      </div>
    </div>
  );
}
