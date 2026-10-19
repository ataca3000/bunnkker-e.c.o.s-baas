import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ds/use-toast';
import { useFormatter } from '@/hooks/use-formatter';
import {
  useCampaign,
  useCampaignAdSets,
  useCampaignCreatives,
  useCampaignInsights,
  useCampaignInsightTrend,
  useUpdateCampaignBusinessContext,
} from '../hooks/use-campaigns';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_OBJECTIVE_LABELS,
  SEASON_LABELS,
  BUSINESS_GOAL_LABELS,
  type CampaignStatus,
  type Season,
  type BusinessGoal,
} from '../types/campaign';

interface CampaignDrawerProps {
  campaignId: string | null;
  open: boolean;
  onClose: () => void;
}

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-end ml-4">{value ?? '—'}</span>
    </div>
  );
}

export function CampaignDrawer({ campaignId, open, onClose }: CampaignDrawerProps) {
  const { money } = useFormatter();
  const { data: campaign, isLoading } = useCampaign(campaignId ?? undefined);
  const { data: adSetsData }          = useCampaignAdSets(campaignId ?? undefined);
  const { data: creativesData }       = useCampaignCreatives(campaignId ?? undefined);
  const { data: insightsData }        = useCampaignInsights(campaignId ?? undefined, { level: 'campaign', per_page: 30 });
  const { data: trend }               = useCampaignInsightTrend(campaignId ?? undefined, 30);

  const updateCtx = useUpdateCampaignBusinessContext(campaignId ?? '');
  const { toast } = useToast();

  const [notes, setNotes] = useState('');
  const [notesEditing, setNotesEditing] = useState(false);

  const adSets   = adSetsData?.data ?? [];
  const creatives = creativesData?.data ?? [];
  const insights  = insightsData?.data ?? [];

  const ctx = campaign?.business_context;
  const latest = campaign?.latest_insight;

  function saveNotes() {
    updateCtx.mutate(
      { internal_notes: notes },
      {
        onSuccess: () => {
          toast({ title: 'Notes saved' });
          setNotesEditing(false);
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        {isLoading || !campaign ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            {isLoading ? 'Loading…' : 'Campaign not found.'}
          </div>
        ) : (
          <>
            <SheetHeader className="pb-4 border-b">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-base leading-snug truncate">
                    {campaign.name}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${STATUS_COLORS[campaign.status] ?? ''}`}
                    >
                      {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {campaign.connector_type}
                    </span>
                    {ctx?.business_goal && (
                      <span className="text-xs text-muted-foreground">
                        · {BUSINESS_GOAL_LABELS[ctx.business_goal as BusinessGoal] ?? ctx.business_goal}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="ad-sets">Ad Sets ({adSets.length})</TabsTrigger>
                <TabsTrigger value="creatives">Creatives ({creatives.length})</TabsTrigger>
                <TabsTrigger value="business">Business</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>

              {/* ── Overview ── */}
              <TabsContent value="overview" className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">Provider Identity</h3>
                  <div className="rounded-md border px-3">
                    <Row label="Campaign ID"   value={<code className="text-xs">{campaign.external_campaign_id}</code>} />
                    <Row label="Account"       value={campaign.external_account_id} />
                    <Row label="Objective"     value={CAMPAIGN_OBJECTIVE_LABELS[campaign.objective ?? ''] ?? campaign.objective} />
                    <Row label="Buying Type"   value={campaign.buying_type} />
                    <Row label="Bid Strategy"  value={campaign.bid_strategy} />
                    <Row label="Budget"        value={campaign.budget_display} />
                    <Row label="Budget Remaining" value={campaign.budget_remaining != null ? money(campaign.budget_remaining) : undefined} />
                    <Row label="Start"         value={campaign.start_time?.split('T')[0]} />
                    <Row label="Stop"          value={campaign.stop_time?.split('T')[0]} />
                    <Row label="Last Synced"   value={campaign.last_synced_at?.split('T')[0]} />
                  </div>
                </div>
                {ctx && (
                  <div>
                    <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">Business Identity (ECOS)</h3>
                    <div className="rounded-md border px-3">
                      <Row label="Season"       value={ctx.season ? (SEASON_LABELS[ctx.season as Season] ?? ctx.season) : undefined} />
                      <Row label="Business Goal" value={ctx.business_goal ? (BUSINESS_GOAL_LABELS[ctx.business_goal as BusinessGoal] ?? ctx.business_goal) : undefined} />
                      <Row label="Priority"     value={ctx.internal_priority} />
                      <Row label="Internal Status" value={ctx.internal_status} />
                      <Row label="Cost Center"  value={ctx.cost_center} />
                      <Row label="Team"         value={ctx.marketing_team} />
                      <Row label="Business Unit" value={ctx.business_unit} />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Performance ── */}
              <TabsContent value="performance" className="space-y-4">
                {latest ? (
                  <>
                    <div>
                      <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">
                        Latest Snapshot ({latest.date_start} → {latest.date_stop})
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['Spend',        money(latest.spend)],
                          ['Impressions',  fmtInt(latest.impressions)],
                          ['Reach',        fmtInt(latest.reach)],
                          ['Clicks',       fmtInt(latest.clicks)],
                          ['CTR',          fmtPct(latest.ctr)],
                          ['CPC',          money(latest.cpc)],
                          ['CPM',          money(latest.cpm)],
                          ['Purchases',    fmtInt(latest.purchases)],
                          ['Leads',        fmtInt(latest.leads)],
                          ['Messages',     fmtInt(latest.messages)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-md border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-lg font-semibold">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {trend && trend.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">
                          30-Day Daily Spend Trend
                        </h3>
                        <div className="rounded-md border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-start px-2 py-1.5 font-medium">Date</th>
                                <th className="text-end px-2 py-1.5 font-medium">Spend</th>
                                <th className="text-end px-2 py-1.5 font-medium">CTR</th>
                                <th className="text-end px-2 py-1.5 font-medium">CPC</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {trend.slice(0, 14).map((row) => (
                                <tr key={row.id} className="hover:bg-muted/20">
                                  <td className="px-2 py-1 font-mono">{row.date_start}</td>
                                  <td className="px-2 py-1 text-end">{money(row.spend)}</td>
                                  <td className="px-2 py-1 text-end">{fmtPct(row.ctr)}</td>
                                  <td className="px-2 py-1 text-end">{money(row.cpc)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No performance data yet. Run a sync with insights enabled.
                  </p>
                )}
              </TabsContent>

              {/* ── Ad Sets ── */}
              <TabsContent value="ad-sets">
                {adSets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No ad sets synced yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {adSets.map((adSet) => (
                      <div key={adSet.id} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate max-w-[300px]">{adSet.name}</span>
                          <Badge variant="outline" className="text-xs">{adSet.status}</Badge>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          {adSet.daily_budget != null && <span>Daily: {money(adSet.daily_budget)}</span>}
                          {adSet.optimization_goal && <span>{adSet.optimization_goal}</span>}
                          {adSet.ads_count != null && <span>{adSet.ads_count} ads</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Creatives ── */}
              <TabsContent value="creatives">
                {creatives.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No creatives synced yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {creatives.map((creative) => (
                      <div key={creative.id} className="rounded-md border overflow-hidden">
                        {(creative.image_url || creative.thumbnail_url) && (
                          <img
                            src={creative.thumbnail_url ?? creative.image_url ?? ''}
                            alt={creative.name}
                            className="w-full h-32 object-cover bg-muted"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="p-3 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{creative.name}</span>
                            <Badge variant="outline" className="text-xs">{creative.creative_type}</Badge>
                          </div>
                          {creative.headline && (
                            <p className="text-xs font-medium">{creative.headline}</p>
                          )}
                          {creative.primary_text && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {creative.primary_text}
                            </p>
                          )}
                          {creative.call_to_action && (
                            <span className="inline-block mt-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {creative.call_to_action}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Business Context ── */}
              <TabsContent value="business" className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">
                    Business Context — ECOS Managed
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    These fields are never overwritten by provider sync.
                  </p>
                  <div className="rounded-md border px-3">
                    <Row label="Season"        value={ctx?.season ? (SEASON_LABELS[ctx.season as Season] ?? ctx.season) : undefined} />
                    <Row label="Business Goal" value={ctx?.business_goal ? (BUSINESS_GOAL_LABELS[ctx.business_goal as BusinessGoal] ?? ctx.business_goal) : undefined} />
                    <Row label="Priority"      value={ctx?.internal_priority} />
                    <Row label="Status"        value={ctx?.internal_status} />
                    <Row label="Cost Center"   value={ctx?.cost_center} />
                    <Row label="Team"          value={ctx?.marketing_team} />
                    <Row label="Business Unit" value={ctx?.business_unit} />
                    <Row label="Tags"          value={ctx?.internal_tags?.join(', ')} />
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium uppercase text-muted-foreground mb-2">Internal Notes</h3>
                  {notesEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={5}
                        placeholder="Add internal notes for this campaign…"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveNotes} disabled={updateCtx.isPending}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setNotesEditing(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-md border p-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/30 min-h-[80px]"
                      onClick={() => {
                        setNotes(ctx?.internal_notes ?? '');
                        setNotesEditing(true);
                      }}
                    >
                      {ctx?.internal_notes || 'Click to add notes…'}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Insights History ── */}
              <TabsContent value="insights">
                {insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No insight snapshots yet. Run a sync with insights enabled.
                  </p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="text-start px-2 py-1.5 font-medium">Date</th>
                          <th className="text-end px-2 py-1.5 font-medium">Spend</th>
                          <th className="text-end px-2 py-1.5 font-medium">Impr.</th>
                          <th className="text-end px-2 py-1.5 font-medium">Clicks</th>
                          <th className="text-end px-2 py-1.5 font-medium">CTR</th>
                          <th className="text-end px-2 py-1.5 font-medium">CPC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {insights.map((row) => (
                          <tr key={row.id} className="hover:bg-muted/20">
                            <td className="px-2 py-1 font-mono">{row.date_start}</td>
                            <td className="px-2 py-1 text-end">{money(row.spend)}</td>
                            <td className="px-2 py-1 text-end">{fmtInt(row.impressions)}</td>
                            <td className="px-2 py-1 text-end">{fmtInt(row.clicks)}</td>
                            <td className="px-2 py-1 text-end">{fmtPct(row.ctr)}</td>
                            <td className="px-2 py-1 text-end">{money(row.cpc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── Raw Provider Data ── */}
              <TabsContent value="raw">
                <div className="text-xs text-muted-foreground mb-2">
                  Provider payload — immutable, read-only. Managed by sync.
                </div>
                <div className="rounded-md border p-3">
                  <div className="rounded-md border px-3 mb-3">
                    <Row label="External ID"      value={<code className="text-xs">{campaign.external_campaign_id}</code>} />
                    <Row label="Provider Created" value={campaign.provider_created_at?.split('T')[0]} />
                    <Row label="Provider Updated" value={campaign.provider_updated_at?.split('T')[0]} />
                    <Row label="Next Sync"        value={campaign.next_sync_at?.split('T')[0]} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
