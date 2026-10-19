import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Play, Ban, Wand2, Check, FileDiff, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ds/use-toast';
import { useRepairSession } from '../../hooks/useRepairSessions';
import { repairService } from '../../services/repair-service';
import RepairPromptViewer from './RepairPromptViewer';
import type { RepairResponseType, RepairSessionStatus } from '../../types/engineering';

interface Props {
  sessionId: string | null;
  onClose: () => void;
}

import { repairStatusColor } from './repair-status-colors';

const TERMINAL_STATUSES: RepairSessionStatus[] = ['completed', 'failed', 'cancelled', 'timeout'];

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

const RESPONSE_TYPE_OPTIONS: RepairResponseType[] = ['patch', 'explanation', 'clarification_request', 'error'];

export default function RepairSessionDrawer({ sessionId, onClose }: Props) {
  const { session, loading, refetch } = useRepairSession(sessionId);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [responseContent, setResponseContent] = useState('');
  const [responseType, setResponseType] = useState<RepairResponseType>('patch');

  if (!sessionId) return null;

  const isTerminal = session ? TERMINAL_STATUSES.includes(session.status) : false;
  const activePrompt = session?.prompts?.find(p => p.is_active) ?? null;
  const hasAppliedPatch = (session?.patches ?? []).some(p => p.is_applied);

  const runAction = async (action: () => Promise<unknown>, successTitle: string, errorTitle: string) => {
    setBusy(true);
    try {
      await action();
      toast({ title: successTitle });
      await refetch();
    } catch {
      toast({ title: errorTitle, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const submitResponse = async () => {
    if (!responseContent.trim()) {
      toast({ title: 'Response content is required', variant: 'destructive' });
      return;
    }
    await runAction(
      () => repairService.submitResponse(sessionId, { response_type: responseType, response_content: responseContent }),
      'Response submitted',
      'Failed to submit response',
    );
    setResponseContent('');
  };

  return (
    <Sheet open={!!sessionId} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent className="w-[560px] sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span>Repair Session</span>
            {session && (
              <>
                <Badge variant="outline" className="capitalize">{humanize(session.failure_type)}</Badge>
                <Badge className={`${repairStatusColor(session.status)} text-white capitalize`}>
                  {humanize(session.status)}
                </Badge>
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {loading && !session && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading session…</span>
          </div>
        )}

        {session && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">{session.failure_summary}</p>
            {session.failed_reason && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {session.failed_reason}
              </div>
            )}

            <Tabs defaultValue="overview">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="prompt" className="flex-1">Prompt</TabsTrigger>
                <TabsTrigger value="response" className="flex-1">Response</TabsTrigger>
                <TabsTrigger value="patches" className="flex-1">Patches</TabsTrigger>
              </TabsList>

              {/* ── Overview ─────────────────────────────────────────── */}
              <TabsContent value="overview" className="mt-4 space-y-4 text-sm">
                {session.analysis ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Root Cause</p>
                      <p className="font-medium capitalize">{humanize(session.analysis.failure_category)}</p>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{session.analysis.root_cause}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-muted/50 rounded-md px-2 py-1.5">
                        <p className="text-muted-foreground">Confidence</p>
                        <p className="font-semibold tabular-nums">{Math.round(session.analysis.confidence_score * 100)}%</p>
                      </div>
                      <div className="bg-muted/50 rounded-md px-2 py-1.5">
                        <p className="text-muted-foreground">Effort</p>
                        <p className="font-semibold capitalize">{humanize(session.analysis.estimated_effort)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-md px-2 py-1.5">
                        <p className="text-muted-foreground">Approach</p>
                        <Badge variant="secondary" className="capitalize text-[10px] mt-0.5">
                          {humanize(session.analysis.repair_approach)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No analysis yet. Run Analyze to detect the root cause.</p>
                )}

                <div className="flex items-center gap-2">
                  {session.status === 'pending' && (
                    <Button size="sm" disabled={busy}
                      onClick={() => runAction(() => repairService.analyzeSession(session.id), 'Analysis started', 'Failed to start analysis')}>
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      Analyze
                    </Button>
                  )}
                  {!isTerminal && (
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => runAction(() => repairService.cancelSession(session.id), 'Session cancelled', 'Failed to cancel session')}>
                      <Ban className="h-3.5 w-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-medium mb-2">Session History ({session.history?.length ?? 0})</p>
                  {!session.history || session.history.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No events recorded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {session.history.map(ev => (
                        <div key={ev.id} className="flex items-start justify-between gap-2 text-xs py-1 border-b last:border-0">
                          <span className="font-medium capitalize">{humanize(ev.event_type)}</span>
                          <span className="text-muted-foreground shrink-0">{new Date(ev.occurred_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Prompt ───────────────────────────────────────────── */}
              <TabsContent value="prompt" className="mt-4 space-y-4">
                {session.analysis && !activePrompt && (
                  <Button size="sm" disabled={busy}
                    onClick={() => runAction(() => repairService.generatePrompt(session.id), 'Prompt generated', 'Failed to generate prompt')}>
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    Generate Prompt
                  </Button>
                )}
                {activePrompt ? (
                  <RepairPromptViewer
                    prompt={activePrompt}
                    onMarkSent={() => runAction(
                      () => repairService.markPromptSent(session.id, activePrompt.id),
                      'Prompt marked as sent',
                      'Failed to mark prompt as sent',
                    )}
                  />
                ) : (
                  !session.analysis && (
                    <p className="text-xs text-muted-foreground">Analysis must complete before a prompt can be generated.</p>
                  )
                )}
              </TabsContent>

              {/* ── Response ─────────────────────────────────────────── */}
              <TabsContent value="response" className="mt-4 space-y-4">
                {session.status === 'awaiting_response' && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium mb-1">Response Type</p>
                      <Select value={responseType} onValueChange={v => setResponseType(v as RepairResponseType)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESPONSE_TYPE_OPTIONS.map(t => (
                            <SelectItem key={t} value={t} className="capitalize text-xs">{humanize(t)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-1">Claude Code Response</p>
                      <Textarea
                        value={responseContent}
                        onChange={e => setResponseContent(e.target.value)}
                        placeholder="Paste the Claude Code response here…"
                        className="min-h-[160px] font-mono text-xs"
                      />
                    </div>
                    <Button size="sm" disabled={busy || !responseContent.trim()} onClick={submitResponse}>
                      Submit Response
                    </Button>
                    <Separator />
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium mb-2">Past Responses ({session.responses?.length ?? 0})</p>
                  {!session.responses || session.responses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No responses recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {session.responses.map(r => (
                        <div key={r.id} className="bg-muted/50 rounded-md px-3 py-2 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="capitalize text-[10px]">{humanize(r.response_type)}</Badge>
                              {r.review_decision && (
                                <Badge
                                  variant={r.review_decision === 'rejected' ? 'destructive' : 'outline'}
                                  className="capitalize text-[10px]"
                                >
                                  {r.review_decision}
                                </Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground shrink-0">{new Date(r.received_at).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{r.response_content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Patches ──────────────────────────────────────────── */}
              <TabsContent value="patches" className="mt-4 space-y-4">
                {!session.patches || session.patches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No patches extracted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {session.patches.map(patch => (
                      <div key={patch.id} className="border rounded-md px-3 py-2.5 text-xs space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              <FileDiff className="h-3 w-3 mr-1" />
                              {patch.patch_format}
                            </Badge>
                            <span className="text-muted-foreground">
                              {patch.files_affected?.length ?? 0} file{(patch.files_affected?.length ?? 0) === 1 ? '' : 's'}
                            </span>
                            <span className="text-green-600 tabular-nums">+{patch.lines_added}</span>
                            <span className="text-red-600 tabular-nums">-{patch.lines_removed}</span>
                          </div>
                          {patch.is_applied ? (
                            <Badge className="bg-green-600 text-white text-[10px]">
                              <Check className="h-3 w-3 mr-1" />
                              Applied
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy}
                              onClick={() => runAction(
                                () => repairService.applyPatch(session.id, patch.id),
                                'Patch applied',
                                'Failed to apply patch',
                              )}>
                              Apply Patch
                            </Button>
                          )}
                        </div>
                        {patch.files_affected && patch.files_affected.length > 0 && (
                          <div className="space-y-0.5">
                            {patch.files_affected.map(f => (
                              <code key={f} className="block bg-muted px-1.5 py-0.5 rounded truncate">{f}</code>
                            ))}
                          </div>
                        )}
                        {patch.is_applied && (
                          <p className="text-muted-foreground">
                            Applied {patch.applied_at ? new Date(patch.applied_at).toLocaleString() : ''}
                            {patch.applied_by ? ` by ${patch.applied_by}` : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {hasAppliedPatch && !isTerminal && (
                  <Button size="sm" disabled={busy}
                    onClick={() => runAction(
                      () => repairService.completeSession(session.id),
                      'Session completed',
                      'Failed to complete session',
                    )}>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Complete Session
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
