import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ds/use-toast';
import {
  useInitiative,
  useCreateInitiative,
  useUpdateInitiative,
  useInitiativeKpis,
  useInitiativeCampaigns,
  useAssignCampaigns,
  useRemoveCampaign,
} from '../hooks/use-initiatives';
import {
  useCampaigns,
} from '../hooks/use-campaigns';
import {
  INITIATIVE_STATUS_LABELS,
  INITIATIVE_STATUS_COLORS,
  type InitiativeStatus,
  type MarketingInitiative,
} from '../types/initiative';
import {
  BUSINESS_GOAL_LABELS,
  SEASON_LABELS,
  CAMPAIGN_STATUS_LABELS,
} from '../types/campaign';
import { Loader2, X } from 'lucide-react';
import { DEFAULT_CURRENCY } from '@/lib/format';

const STATUS_OPTIONS: InitiativeStatus[] = ['draft', 'active', 'paused', 'completed', 'cancelled'];

const TABS = [
  'Overview',
  'Campaigns',
  'Business Context',
  'KPIs',
  'Notes',
  'Financials',
] as const;
type Tab = (typeof TABS)[number];

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString()}`;
}

function fmtDec(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${((n ?? 0) * 100).toFixed(2)}%`;
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function OverviewTab({ initiative, onSave }: {
  initiative: MarketingInitiative;
  onSave: (payload: Partial<MarketingInitiative>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<Partial<MarketingInitiative>>({});

  function handleEdit() {
    setForm({
      name:        initiative.name,
      description: initiative.description ?? '',
      status:      initiative.status,
      start_date:  initiative.start_date ?? '',
      end_date:    initiative.end_date ?? '',
      budget:      initiative.budget ?? undefined,
      currency:    initiative.currency,
    });
    setEditing(true);
  }

  function handleSave() {
    onSave(form);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-4 pt-2">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Name</label>
          <Input
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Description</label>
          <Textarea
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Status</label>
            <Select value={form.status ?? 'draft'} onValueChange={(v) => setForm({ ...form, status: v as InitiativeStatus })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{INITIATIVE_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Currency</label>
            <Input value={form.currency ?? DEFAULT_CURRENCY} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</label>
            <Input type="date" value={form.start_date ?? ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wide">End Date</label>
            <Input type="date" value={form.end_date ?? ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Budget</label>
          <Input
            type="number"
            value={form.budget ?? ''}
            onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">{initiative.name}</h2>
          {initiative.description && (
            <p className="text-sm text-muted-foreground mt-1">{initiative.description}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</div>
          <Badge variant="secondary" className={`text-xs ${INITIATIVE_STATUS_COLORS[initiative.status] ?? ''}`}>
            {INITIATIVE_STATUS_LABELS[initiative.status]}
          </Badge>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Budget</div>
          <span className="font-medium">
            {initiative.budget != null ? `${initiative.currency} ${initiative.budget.toLocaleString()}` : '—'}
          </span>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Start Date</div>
          <span>{initiative.start_date ?? '—'}</span>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">End Date</div>
          <span>{initiative.end_date ?? '—'}</span>
        </div>
      </div>

      {initiative.days_remaining != null && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Timeline</div>
          <div className="flex items-center gap-4">
            <span>{initiative.days_remaining}d remaining</span>
            {initiative.progress_percent != null && (
              <div className="flex items-center gap-2 flex-1">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, initiative.progress_percent)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{initiative.progress_percent}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {initiative.template && (
        <div className="text-sm text-muted-foreground">
          Template: <span className="font-medium">{initiative.template.name}</span>
        </div>
      )}
    </div>
  );
}

function CampaignsTab({ initiativeId }: { initiativeId: string }) {
  const { data: assignedData, isLoading } = useInitiativeCampaigns(initiativeId);
  const { data: allData } = useCampaigns({ unassigned: true, per_page: 50 });
  const assignCampaigns  = useAssignCampaigns(initiativeId);
  const removeCampaign   = useRemoveCampaign(initiativeId);
  const { toast } = useToast();
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected]     = useState<string[]>([]);

  const assigned = (assignedData as { data?: Array<{ id: string; name: string; status: string }> })?.data ?? [];
  const unassigned = (allData as { data?: Array<{ id: string; name: string; status: string }> })?.data ?? [];

  function handleAssign() {
    if (!selected.length) return;
    assignCampaigns.mutate(selected, {
      onSuccess: () => {
        toast({ title: `${selected.length} campaign(s) assigned.` });
        setSelected([]);
        setShowPicker(false);
      },
    });
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{assigned.length} campaigns</span>
        <Button size="sm" variant="outline" onClick={() => setShowPicker(!showPicker)}>
          {showPicker ? 'Cancel' : 'Add Campaigns'}
        </Button>
      </div>

      {showPicker && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Unassigned campaigns</p>
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unassigned campaigns available.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {unassigned.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={(e) => {
                      setSelected(e.target.checked
                        ? [...selected, c.id]
                        : selected.filter((x) => x !== c.id));
                    }}
                  />
                  {c.name}
                  <Badge variant="secondary" className="text-xs ms-auto">
                    {CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? c.status}
                  </Badge>
                </label>
              ))}
            </div>
          )}
          <Button size="sm" disabled={!selected.length} onClick={handleAssign}>
            Assign {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="size-4 animate-spin mx-auto" /></div>
      ) : assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No campaigns assigned yet.</p>
      ) : (
        <div className="space-y-1">
          {assigned.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? c.status}
                </Badge>
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => removeCampaign.mutate(c.id, {
                    onSuccess: () => toast({ title: 'Campaign removed from initiative.' }),
                  })}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessContextTab({ initiative, onSave }: {
  initiative: MarketingInitiative;
  onSave: (payload: Partial<MarketingInitiative>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState<Partial<MarketingInitiative>>({});

  function handleEdit() {
    setForm({
      business_unit: initiative.business_unit ?? '',
      season:        initiative.season ?? undefined,
      business_goal: initiative.business_goal ?? undefined,
      cost_center:   initiative.cost_center ?? '',
      marketing_team: initiative.marketing_team ?? '',
    });
    setEditing(true);
  }

  function handleSave() {
    onSave(form);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="space-y-4 pt-2">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Business Unit</label>
          <Input value={form.business_unit ?? ''} onChange={(e) => setForm({ ...form, business_unit: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Season</label>
          <Select value={form.season ?? 'none'} onValueChange={(v) => setForm({ ...form, season: v === 'none' ? undefined : v as MarketingInitiative['season'] })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {Object.entries(SEASON_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Business Goal</label>
          <Select value={form.business_goal ?? 'none'} onValueChange={(v) => setForm({ ...form, business_goal: v === 'none' ? undefined : v as MarketingInitiative['business_goal'] })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {Object.entries(BUSINESS_GOAL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Cost Center</label>
          <Input value={form.cost_center ?? ''} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Marketing Team</label>
          <Input value={form.marketing_team ?? ''} onChange={(e) => setForm({ ...form, marketing_team: e.target.value })} className="mt-1" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
      </div>
      <div className="divide-y rounded-md border overflow-hidden text-sm">
        <div className="flex justify-between px-3 py-2">
          <span className="text-muted-foreground">Business Unit</span>
          <span>{initiative.business_unit ?? '—'}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-muted-foreground">Season</span>
          <span>{initiative.season ? (SEASON_LABELS[initiative.season] ?? initiative.season) : '—'}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-muted-foreground">Business Goal</span>
          <span>{initiative.business_goal ? (BUSINESS_GOAL_LABELS[initiative.business_goal] ?? initiative.business_goal) : '—'}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-muted-foreground">Cost Center</span>
          <span>{initiative.cost_center ?? '—'}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-muted-foreground">Marketing Team</span>
          <span>{initiative.marketing_team ?? '—'}</span>
        </div>
        <div className="flex justify-between px-3 py-2">
          <span className="text-muted-foreground">Owner</span>
          <span>{initiative.owner_id ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

function KpisTab({ initiativeId }: { initiativeId: string }) {
  const [preset, setPreset] = useState('last_30d');
  const { data: kpis, isLoading } = useInitiativeKpis(initiativeId, preset);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Performance KPIs</span>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="last_7d">Last 7 days</SelectItem>
            <SelectItem value="last_30d">Last 30 days</SelectItem>
            <SelectItem value="last_90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="size-4 animate-spin mx-auto" /></div>
      ) : kpis ? (
        <div className="space-y-4">
          <div className="rounded-md border divide-y text-sm">
            <KpiRow label="Campaigns"         value={fmt(kpis.campaign_count)} />
            <KpiRow label="Active Campaigns"  value={fmt(kpis.active_campaigns)} />
          </div>
          <div className="rounded-md border divide-y text-sm">
            <KpiRow label="Budget"            value={fmtDec(kpis.budget)} />
            <KpiRow label="Total Spend"       value={fmtDec(kpis.total_spend)} />
            <KpiRow label="Budget Utilization" value={fmtPct(kpis.budget_utilization)} />
          </div>
          <div className="rounded-md border divide-y text-sm">
            <KpiRow label="Reach"             value={fmt(kpis.total_reach)} />
            <KpiRow label="Impressions"       value={fmt(kpis.total_impressions)} />
            <KpiRow label="Clicks"            value={fmt(kpis.total_clicks)} />
            <KpiRow label="Avg. CTR"          value={fmtPct(kpis.avg_ctr)} />
            <KpiRow label="Avg. CPC"          value={fmtDec(kpis.avg_cpc)} />
            <KpiRow label="Avg. CPM"          value={fmtDec(kpis.avg_cpm)} />
          </div>
          <div className="rounded-md border divide-y text-sm">
            <KpiRow label="Purchases"         value={fmt(kpis.total_purchases)} />
            <KpiRow label="Leads"             value={fmt(kpis.total_leads)} />
            <KpiRow label="Messages"          value={fmt(kpis.total_messages)} />
          </div>
          <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground text-center">
            Revenue · Profit · ROAS — Marketing Finance module (coming soon)
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotesTab({ initiative, onSave }: {
  initiative: MarketingInitiative;
  onSave: (payload: Partial<MarketingInitiative>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes]     = useState(initiative.internal_notes ?? '');

  return (
    <div className="space-y-3 pt-2">
      {editing ? (
        <>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            placeholder="Internal notes…"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onSave({ internal_notes: notes }); setEditing(false); }}>Save</Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit Notes</Button>
          </div>
          <div className="rounded-md border p-3 text-sm min-h-[120px] whitespace-pre-wrap">
            {initiative.internal_notes || <span className="text-muted-foreground">No internal notes.</span>}
          </div>
        </>
      )}
    </div>
  );
}

function FinancialsTab() {
  return (
    <div className="pt-4 text-center space-y-2">
      <div className="text-2xl">📊</div>
      <p className="text-sm font-medium">Marketing Finance</p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
        Revenue attribution, profit tracking, and ROAS will be available when the Marketing Finance module launches.
        This initiative will serve as the primary entity for all financial reporting.
      </p>
    </div>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateForm({ onCreated, onCancel }: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const createInitiative = useCreateInitiative();
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<MarketingInitiative>>({ status: 'draft', currency: DEFAULT_CURRENCY });

  function handleCreate() {
    if (!form.name?.trim()) return;
    createInitiative.mutate(form, {
      onSuccess: (created) => {
        toast({ title: `Initiative "${created.name}" created.` });
        onCreated(created.id);
      },
    });
  }

  return (
    <div className="space-y-4 pt-2">
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wide">Name *</label>
        <Input
          value={form.name ?? ''}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Initiative name"
          className="mt-1"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wide">Description</label>
        <Textarea
          value={form.description ?? ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Business Goal</label>
          <Select value={form.business_goal ?? 'none'} onValueChange={(v) => setForm({ ...form, business_goal: v === 'none' ? undefined : v as MarketingInitiative['business_goal'] })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {Object.entries(BUSINESS_GOAL_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Season</label>
          <Select value={form.season ?? 'none'} onValueChange={(v) => setForm({ ...form, season: v === 'none' ? undefined : v as MarketingInitiative['season'] })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {Object.entries(SEASON_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Start Date</label>
          <Input type="date" value={form.start_date ?? ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">End Date</label>
          <Input type="date" value={form.end_date ?? ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Budget</label>
          <Input type="number" value={form.budget ?? ''} onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : undefined })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wide">Currency</label>
          <Input value={form.currency ?? DEFAULT_CURRENCY} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" disabled={!form.name?.trim() || createInitiative.isPending} onClick={handleCreate}>
          {createInitiative.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
          Create Initiative
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

interface InitiativeDrawerProps {
  initiativeId: string | null;
  open: boolean;
  onClose: () => void;
  createMode?: boolean;
  onCreated?: (id: string) => void;
}

export function InitiativeDrawer({
  initiativeId,
  open,
  onClose,
  createMode = false,
  onCreated,
}: InitiativeDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const { toast } = useToast();

  const { data: initiative, isLoading } = useInitiative(initiativeId ?? undefined);
  const updateInitiative = useUpdateInitiative(initiativeId ?? '');

  function handleSave(payload: Partial<MarketingInitiative>) {
    if (!initiativeId) return;
    updateInitiative.mutate(payload, {
      onSuccess: () => toast({ title: 'Initiative updated.' }),
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {createMode ? 'New Initiative' : (initiative?.name ?? 'Initiative')}
          </SheetTitle>
        </SheetHeader>

        {createMode ? (
          <CreateForm
            onCreated={(id) => { onCreated?.(id); }}
            onCancel={onClose}
          />
        ) : isLoading || !initiative ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-0.5 border-b mt-4 mb-1 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="pb-8">
              {activeTab === 'Overview'          && <OverviewTab initiative={initiative} onSave={handleSave} />}
              {activeTab === 'Campaigns'         && <CampaignsTab initiativeId={initiative.id} />}
              {activeTab === 'Business Context'  && <BusinessContextTab initiative={initiative} onSave={handleSave} />}
              {activeTab === 'KPIs'              && <KpisTab initiativeId={initiative.id} />}
              {activeTab === 'Notes'             && <NotesTab initiative={initiative} onSave={handleSave} />}
              {activeTab === 'Financials'        && <FinancialsTab />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
