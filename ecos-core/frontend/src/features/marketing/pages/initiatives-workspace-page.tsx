import { useState } from 'react';
import { useInitiatives, useCreateInitiative, useArchiveInitiative, useInitiativeTemplates } from '../hooks/use-initiatives';
import { InitiativeDrawer } from '../drawers/initiative-drawer';
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
import { useToast } from '@/components/ds/use-toast';
import {
  INITIATIVE_STATUS_LABELS,
  INITIATIVE_STATUS_COLORS,
  type InitiativeStatus,
} from '../types/initiative';
import { BUSINESS_GOAL_LABELS, SEASON_LABELS } from '../types/campaign';
import { Plus, TrendingUp, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/router/routes';

const STATUS_OPTIONS: InitiativeStatus[] = ['draft', 'active', 'paused', 'completed', 'archived', 'cancelled'];

function ProgressBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function InitiativesWorkspacePage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search,      setSearch]      = useState('');
  const [status,      setStatus]      = useState('');
  const [businessGoal, setBusinessGoal] = useState('');
  const [page,        setPage]        = useState(1);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const { data, isLoading } = useInitiatives({
    search:        search || undefined,
    status:        status || undefined,
    business_goal: businessGoal || undefined,
    per_page:      25,
    page,
  });

  const { data: templates } = useInitiativeTemplates();

  const createInitiative = useCreateInitiative();
  const archiveInitiative = useArchiveInitiative();

  const initiatives = data?.data ?? [];
  const meta        = data?.meta;

  function handleArchive(id: string, name: string) {
    if (!confirm(`Archive "${name}"? Campaigns will remain linked but the initiative will be read-only.`)) return;
    archiveInitiative.mutate(id, {
      onSuccess: () => toast({ title: 'Initiative archived.' }),
    });
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Marketing Initiatives</h1>
          <p className="text-sm text-muted-foreground">
            {meta?.total ?? 0} initiatives · ERP business layer above campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(ROUTES.marketingInitiativeDash)}
          >
            <TrendingUp className="size-4 mr-1.5" />
            Executive View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            Templates
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="size-4 mr-1.5" />
            New Initiative
          </Button>
        </div>
      </div>

      {/* Template picker */}
      {showTemplates && templates && templates.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-4">
          <h2 className="text-sm font-medium mb-3">Start from a Template</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                className="rounded-md border bg-card p-3 text-start hover:bg-muted/60 transition-colors text-sm"
                onClick={() => {
                  createInitiative.mutate(
                    {
                      name:          tpl.name,
                      business_goal: (tpl.defaults?.business_goal as string) ?? undefined,
                      season:        (tpl.defaults?.season as string) ?? undefined,
                      status:        'draft',
                    } as never,
                    {
                      onSuccess: (created) => {
                        setShowTemplates(false);
                        toast({ title: `Initiative "${created.name}" created.` });
                        setSelectedId(created.id);
                      },
                    },
                  );
                }}
              >
                <div className="font-medium">{tpl.name}</div>
                {tpl.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</div>
                )}
                {tpl.is_system && (
                  <Badge variant="secondary" className="mt-1 text-xs">System</Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search initiatives…"
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
              <SelectItem key={s} value={s}>{INITIATIVE_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={businessGoal || 'all'}
          onValueChange={(v) => { setBusinessGoal(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All goals" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All goals</SelectItem>
            {Object.entries(BUSINESS_GOAL_LABELS).map(([v, l]) => (
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
              <th className="text-start px-3 py-2 font-medium">Initiative</th>
              <th className="text-start px-3 py-2 font-medium">Status</th>
              <th className="text-start px-3 py-2 font-medium">Goal</th>
              <th className="text-start px-3 py-2 font-medium">Season</th>
              <th className="text-end px-3 py-2 font-medium">Budget</th>
              <th className="text-center px-3 py-2 font-medium">Campaigns</th>
              <th className="text-start px-3 py-2 font-medium">Progress</th>
              <th className="text-end px-3 py-2 font-medium">End Date</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-2">
                      <div className="h-4 bg-muted rounded w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : initiatives.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                  No initiatives yet. Create your first marketing initiative to start organizing campaigns.
                </td>
              </tr>
            ) : (
              initiatives.map((initiative) => (
                <tr
                  key={initiative.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedId(initiative.id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium truncate max-w-[220px]" title={initiative.name}>
                      {initiative.name}
                    </div>
                    {initiative.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">
                        {initiative.description}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${INITIATIVE_STATUS_COLORS[initiative.status] ?? ''}`}
                    >
                      {INITIATIVE_STATUS_LABELS[initiative.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {initiative.business_goal
                      ? (BUSINESS_GOAL_LABELS[initiative.business_goal] ?? initiative.business_goal)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {initiative.season
                      ? (SEASON_LABELS[initiative.season] ?? initiative.season)
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-end text-xs">
                    {initiative.budget != null
                      ? `${initiative.currency} ${initiative.budget.toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-medium">
                    {initiative.campaigns_count ?? 0}
                  </td>
                  <td className="px-3 py-2">
                    <ProgressBar value={initiative.progress_percent} />
                  </td>
                  <td className="px-3 py-2 text-end text-xs text-muted-foreground">
                    {initiative.end_date ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <button
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Archive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(initiative.id, initiative.name);
                      }}
                    >
                      <Archive className="size-3.5" />
                    </button>
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Initiative Drawer */}
      <InitiativeDrawer
        initiativeId={selectedId}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />

      {/* Quick-create drawer (blank initiative) */}
      <InitiativeDrawer
        initiativeId={null}
        open={showCreate}
        createMode
        onClose={() => setShowCreate(false)}
        onCreated={(id) => { setShowCreate(false); setSelectedId(id); }}
      />
    </div>
  );
}
