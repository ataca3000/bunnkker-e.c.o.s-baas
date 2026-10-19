import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, RefreshCw, PlayCircle, FileText } from 'lucide-react';
import { useReleases } from '../hooks/useReleases';
import ReleaseKPIRow from '../components/release/ReleaseKPIRow';
import ValidationPanel from '../components/release/ValidationPanel';
import ApprovalPanel from '../components/release/ApprovalPanel';
import PipelineTimeline from '../components/release/PipelineTimeline';
import { releaseService } from '../services/release-service';
import type { EngineeringRelease, ReleaseValidationCheck, ReleaseApproval, ReleasePipelineRun } from '../types/engineering';
import { RELEASE_STATUS_LABELS, RELEASE_STATUS_COLORS } from '../types/engineering';

function StatusBadge({ status }: { status: string }) {
  const color = RELEASE_STATUS_COLORS[status as keyof typeof RELEASE_STATUS_COLORS] ?? 'bg-gray-400';
  const label = RELEASE_STATUS_LABELS[status as keyof typeof RELEASE_STATUS_LABELS] ?? status;
  return <Badge className={`${color} text-white text-xs px-2 py-0.5`}>{label}</Badge>;
}

export default function ReleaseDashboardPage() {
  const {
    releases, page, lastPage, loading, error, dashboard,
    selectedRelease,
    load, loadDashboard, selectRelease, createRelease, transition, runValidation, generateReports, triggerPipeline,
  } = useReleases();

  const [validationChecks, setValidationChecks] = useState<ReleaseValidationCheck[]>([]);
  const [validationScore, setValidationScore] = useState(0);
  const [validating, setValidating] = useState(false);
  const [approvals, setApprovals] = useState<ReleaseApproval[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<ReleasePipelineRun[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', version: '', description: '', release_type: 'standard' });

  const loadReleaseDetail = useCallback(async (release: EngineeringRelease) => {
    await selectRelease(release);
    const [approvalStatus, runs] = await Promise.all([
      releaseService.getApprovalStatus(release.id).catch(() => ({ approvals: [] })),
      releaseService.getPipelineHistory(release.id).catch(() => []),
    ]);
    setApprovals(approvalStatus.approvals ?? []);
    setPipelineRuns(Array.isArray(runs) ? runs : []);
    if (release.readiness_score > 0) {
      setValidationScore(release.readiness_score);
    }
  }, [selectRelease]);

  const handleValidate = useCallback(async () => {
    if (!selectedRelease) return;
    setValidating(true);
    const result = await runValidation(selectedRelease.id);
    if (result) {
      setValidationChecks(result.validation);
      setValidationScore(result.readiness.overall);
    }
    setValidating(false);
  }, [selectedRelease, runValidation]);

  const handleDecideApproval = useCallback(async (approvalId: string, decision: 'approved' | 'rejected', comment?: string) => {
    if (!selectedRelease) return;
    const updated = await releaseService.decideApproval(selectedRelease.id, approvalId, decision, comment);
    setApprovals(prev => prev.map(a => a.id === approvalId ? updated : a));
  }, [selectedRelease]);

  const handleInitiateApprovals = useCallback(async () => {
    if (!selectedRelease) return;
    const initiated = await releaseService.initiateApprovals(selectedRelease.id);
    setApprovals(initiated);
  }, [selectedRelease]);

  const handleCreate = useCallback(async () => {
    const r = await createRelease(createForm);
    if (r) { setShowCreate(false); setCreateForm({ name: '', version: '', description: '', release_type: 'standard' }); }
  }, [createRelease, createForm]);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Release Orchestrator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Engineering Cloud — Release Management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { load(); loadDashboard(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Release
          </Button>
        </div>
      </div>

      {error && <div className="rounded border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

      <ReleaseKPIRow dashboard={dashboard} />

      <div className="flex gap-6 min-h-0">
        {/* Release List */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Release Candidates</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center py-12 text-sm text-muted-foreground">Loading…</div>
              ) : releases.length === 0 ? (
                <div className="flex justify-center items-center py-12 text-sm text-muted-foreground">No releases found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium">Version</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-left px-4 py-2 font-medium">Readiness</th>
                      <th className="text-left px-4 py-2 font-medium">Risk</th>
                      <th className="text-left px-4 py-2 font-medium">Tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map(r => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => loadReleaseDetail(r)}>
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.version ?? '—'}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: r.readiness_score + '%' }} />
                            </div>
                            <span className="text-xs">{r.readiness_score}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={r.risk_level === 'critical' ? 'destructive' : 'outline'} className="text-[10px] capitalize">{r.risk_level}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.task_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {lastPage > 1 && (
                <div className="flex justify-center gap-2 py-3 border-t">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1)}>Prev</Button>
                  <span className="text-sm text-muted-foreground self-center">{page} / {lastPage}</span>
                  <Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => load(page + 1)}>Next</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Release Detail Drawer */}
      <Sheet open={!!selectedRelease} onOpenChange={o => { if (!o) { selectRelease(null); setValidationChecks([]); setApprovals([]); setPipelineRuns([]); } }}>
        <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
          {selectedRelease && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  {selectedRelease.name}
                  <StatusBadge status={selectedRelease.status} />
                  {selectedRelease.version && <span className="text-xs text-muted-foreground font-mono">v{selectedRelease.version}</span>}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedRelease.status === 'draft' && (
                    <Button size="sm" variant="outline" onClick={() => transition(selectedRelease.id, 'collecting')}>Start Collecting</Button>
                  )}
                  {selectedRelease.status === 'collecting' && (
                    <Button size="sm" variant="outline" onClick={() => transition(selectedRelease.id, 'validating')}>Begin Validation</Button>
                  )}
                  {selectedRelease.status === 'ready' && (
                    <Button size="sm" variant="outline" onClick={() => transition(selectedRelease.id, 'approval_pending')}>Request Approval</Button>
                  )}
                  {selectedRelease.status === 'approved' && (
                    <Button size="sm" variant="outline" onClick={() => transition(selectedRelease.id, 'queued')}>Queue for Release</Button>
                  )}
                  {selectedRelease.status === 'queued' && (
                    <Button size="sm" className="bg-violet-600 text-white" onClick={() => triggerPipeline(selectedRelease.id)}>
                      <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                      Trigger Pipeline
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => generateReports(selectedRelease.id)}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Generate Reports
                  </Button>
                </div>

                <Tabs defaultValue="overview">
                  <TabsList className="w-full">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="validation">Validation</TabsTrigger>
                    <TabsTrigger value="approvals">Approvals</TabsTrigger>
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="mt-4 space-y-3 text-sm">
                    {selectedRelease.description && <p className="text-muted-foreground">{selectedRelease.description}</p>}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/50 rounded px-2 py-1.5"><span className="text-muted-foreground">Tasks:</span> {selectedRelease.task_count}</div>
                      <div className="bg-muted/50 rounded px-2 py-1.5"><span className="text-muted-foreground">Environment:</span> {selectedRelease.target_environment}</div>
                      <div className="bg-muted/50 rounded px-2 py-1.5"><span className="text-muted-foreground">Risk:</span> <span className="capitalize">{selectedRelease.risk_level}</span></div>
                      <div className="bg-muted/50 rounded px-2 py-1.5"><span className="text-muted-foreground">Breaking:</span> {selectedRelease.is_breaking_change ? 'Yes' : 'No'}</div>
                    </div>
                  </TabsContent>

                  <TabsContent value="validation" className="mt-4">
                    <ValidationPanel
                      checks={validationChecks}
                      score={validationScore || selectedRelease.readiness_score}
                      onRunValidation={handleValidate}
                      loading={validating}
                    />
                  </TabsContent>

                  <TabsContent value="approvals" className="mt-4">
                    <ApprovalPanel
                      approvals={approvals}
                      onDecide={handleDecideApproval}
                      onInitiate={handleInitiateApprovals}
                      hasApprovals={approvals.length > 0}
                    />
                  </TabsContent>

                  <TabsContent value="pipeline" className="mt-4">
                    <PipelineTimeline
                      runs={pipelineRuns}
                      onTrigger={() => triggerPipeline(selectedRelease.id)}
                      canTrigger={['queued','pipeline_failed'].includes(selectedRelease.status)}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent className="w-[400px]">
          <SheetHeader><SheetTitle>New Release Candidate</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium">Name *</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Release v2.0.0" />
            </div>
            <div>
              <label className="text-xs font-medium">Version</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm mt-1" value={createForm.version} onChange={e => setCreateForm(p => ({ ...p, version: e.target.value }))} placeholder="2.0.0" />
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <textarea className="w-full border rounded px-2 py-1.5 text-sm mt-1 resize-none" rows={3} value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" disabled={!createForm.name} onClick={handleCreate}>Create Release</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
