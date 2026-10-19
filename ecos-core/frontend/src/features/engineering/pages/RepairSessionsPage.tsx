import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, RefreshCw, Eye, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ds/use-toast';
import { useRepairDashboard, useRepairSessions } from '../hooks/useRepairSessions';
import { repairService } from '../services/repair-service';
import RepairSessionDrawer from '../components/repair/RepairSessionDrawer';
import { REPAIR_STATUS_COLORS } from '../components/repair/repair-status-colors';
import type { RepairFailureType, RepairSession, RepairSessionStatus } from '../types/engineering';

const STATUS_OPTIONS: RepairSessionStatus[] = [
  'pending', 'analyzing', 'generating_prompt', 'awaiting_response', 'applying',
  'completed', 'failed', 'cancelled', 'retrying', 'timeout',
];

const FAILURE_TYPE_OPTIONS: RepairFailureType[] = [
  'build_failure', 'test_failure', 'validation_failure', 'security_issue',
  'architecture_violation', 'quality_issue', 'documentation_gap',
  'performance_issue', 'pipeline_failure',
];

const SOURCE_TYPE_OPTIONS = ['manual', 'pipeline', 'engineering_run', 'release', 'ai_review'];

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RepairSessionsPage() {
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState('all');
  const [failureTypeFilter, setFailureTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [creating, setCreating] = useState(false);
  const [newSourceType, setNewSourceType] = useState('manual');
  const [newFailureType, setNewFailureType] = useState<RepairFailureType>('build_failure');
  const [newFailureSummary, setNewFailureSummary] = useState('');

  const filters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    failure_type: failureTypeFilter !== 'all' ? failureTypeFilter : undefined,
    search: search.trim() || undefined,
  }), [statusFilter, failureTypeFilter, search]);

  const { dashboard, refetch: refetchDashboard } = useRepairDashboard(30000);
  const { data: sessionsData, loading, refetch: refetchSessions } = useRepairSessions(filters);

  const sessions: RepairSession[] = Array.isArray(sessionsData)
    ? sessionsData
    : (sessionsData?.data ?? []);

  const refetchAll = async () => {
    await Promise.all([refetchDashboard(), refetchSessions()]);
  };

  const createSession = async () => {
    if (!newFailureSummary.trim()) {
      toast({ title: 'Failure summary is required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await repairService.createSession({
        source_type: newSourceType,
        failure_type: newFailureType,
        failure_summary: newFailureSummary,
      });
      toast({ title: 'Repair session created' });
      setShowCreateForm(false);
      setNewSourceType('manual');
      setNewFailureType('build_failure');
      setNewFailureSummary('');
      await refetchAll();
    } catch {
      toast({ title: 'Failed to create repair session', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await repairService.deleteSession(id);
      toast({ title: 'Repair session deleted' });
      if (selectedSessionId === id) setSelectedSessionId(null);
      await refetchAll();
    } catch {
      toast({ title: 'Failed to delete repair session', variant: 'destructive' });
    }
  };

  const kpis = [
    { label: 'Total Sessions', value: dashboard?.total_sessions ?? 0, highlight: false },
    { label: 'Active Sessions', value: dashboard?.active_sessions ?? 0, highlight: (dashboard?.active_sessions ?? 0) > 0 },
    { label: 'Completed Today', value: dashboard?.completed_today ?? 0, highlight: false },
    { label: 'Success Rate', value: dashboard != null ? `${dashboard.success_rate.toFixed(1)}%` : '—', highlight: false },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Repair Platform</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated failure analysis, Claude Code repair prompts, and patch application
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Repair Session
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label} className={kpi.highlight ? 'border-blue-500/60 bg-blue-500/5' : undefined}>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-3xl font-bold tabular-nums mt-1 ${kpi.highlight ? 'text-blue-600' : ''}`}>
                {kpi.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s} className="capitalize text-xs">{humanize(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={failureTypeFilter} onValueChange={setFailureTypeFilter}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="Failure Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Failure Types</SelectItem>
            {FAILURE_TYPE_OPTIONS.map(t => (
              <SelectItem key={t} value={t} className="capitalize text-xs">{humanize(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search failure summary…"
          className="h-8 w-[260px] text-xs"
        />
      </div>

      {/* Session list */}
      <Card>
        <CardContent className="p-0">
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading sessions…</span>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No repair sessions found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Failure Type</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Retries</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(session => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Badge className={`${REPAIR_STATUS_COLORS[session.status] ?? 'bg-gray-400'} text-white capitalize text-[10px]`}>
                        {humanize(session.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-xs">{humanize(session.failure_type)}</TableCell>
                    <TableCell className="text-xs max-w-[320px]">
                      <span className="block truncate">{session.failure_summary}</span>
                    </TableCell>
                    <TableCell className="capitalize text-xs">{humanize(session.source_type)}</TableCell>
                    <TableCell className="text-center text-xs tabular-nums">
                      {session.retry_count > 0 ? (
                        <Badge variant="outline" className="text-[10px]">{session.retry_count}/{session.max_retries}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {relativeTime(session.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSelectedSessionId(session.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteSession(session.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Session Dialog */}
      <Dialog open={showCreateForm} onOpenChange={o => { if (!o) setShowCreateForm(false); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>New Repair Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs font-medium mb-1">Source Type</p>
              <Select value={newSourceType} onValueChange={setNewSourceType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPE_OPTIONS.map(s => (
                    <SelectItem key={s} value={s} className="capitalize text-xs">{humanize(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Failure Type</p>
              <Select value={newFailureType} onValueChange={v => setNewFailureType(v as RepairFailureType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAILURE_TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t} className="capitalize text-xs">{humanize(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Failure Summary</p>
              <Textarea
                value={newFailureSummary}
                onChange={e => setNewFailureSummary(e.target.value)}
                placeholder="Describe the failure to repair…"
                className="min-h-[100px] text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateForm(false)} disabled={creating}>
              Cancel
            </Button>
            <Button size="sm" onClick={createSession} disabled={creating || !newFailureSummary.trim()}>
              {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Drawer */}
      <RepairSessionDrawer
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
