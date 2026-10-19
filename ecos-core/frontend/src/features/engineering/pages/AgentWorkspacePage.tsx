import React, { useState, useEffect, useCallback } from 'react';
import { useAgentDashboard } from '../hooks/useAgent';
import { agentService } from '../services/agent-service';
import type { EngineeringAgent } from '../types/engineering';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ds/use-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOnline(agent: EngineeringAgent): boolean {
  if (!agent.last_seen_at) return false;
  return (Date.now() - new Date(agent.last_seen_at).getTime()) < 5 * 60 * 1000;
}

function agentDotColor(agent: EngineeringAgent): string {
  if (agent.status === 'busy') return 'bg-amber-500';
  if (!isOnline(agent)) return 'bg-red-500';
  return 'bg-green-500';
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function pct(used: number | null, total: number): number {
  if (used === null || total === 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: string;
  value: number | null;
  label: string;
  badgeClass: string;
}

function KpiCard({ icon, value, label, badgeClass }: KpiCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold tabular-nums">{value ?? '—'}</div>
        <div className="text-xs text-muted-foreground truncate">{label}</div>
      </div>
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', badgeClass)}>
        {value ?? 0}
      </span>
    </div>
  );
}

// ── Resource Bar ──────────────────────────────────────────────────────────────

function ResourceBar({ label, percent, colorClass }: { label: string; percent: number; colorClass: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className={cn('h-1.5 rounded-full transition-all', colorClass)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// ── Agent Detail Panel ────────────────────────────────────────────────────────

interface AgentDetailPanelProps {
  agent: EngineeringAgent;
  onClose: () => void;
}

function AgentDetailPanel({ agent, onClose }: AgentDetailPanelProps) {
  const hb = agent.latest_heartbeat;
  const pi = agent.platform_info;

  const cpuPct   = hb?.cpu_percent ?? 0;
  const memPct   = pi ? pct((hb?.memory_mb_used ?? null), pi.memory_gb * 1024) : 0;
  const diskFree = hb?.disk_free_gb ?? null;
  const diskPct  = pi && diskFree !== null ? Math.max(0, Math.round(((pi.disk_gb - diskFree) / pi.disk_gb) * 100)) : 0;

  return (
    <div className="mt-2 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm">{agent.name} — Details</h3>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClose}>Close</Button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Platform Info */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Platform</p>
          {pi ? (
            <dl className="space-y-0.5 text-xs">
              <div className="flex justify-between"><dt className="text-muted-foreground">OS</dt><dd>{pi.os}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">CPU cores</dt><dd>{pi.cpu_cores}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Memory</dt><dd>{pi.memory_gb} GB</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Disk</dt><dd>{pi.disk_gb} GB</dd></div>
              {pi.claude_version && <div className="flex justify-between"><dt className="text-muted-foreground">Claude</dt><dd>{pi.claude_version}</dd></div>}
              {pi.node_version && <div className="flex justify-between"><dt className="text-muted-foreground">Node</dt><dd>{pi.node_version}</dd></div>}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground italic">No platform data</p>
          )}
        </div>

        {/* Capabilities */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capabilities</p>
          {agent.capabilities && agent.capabilities.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {agent.capabilities.map((cap) => (
                <span
                  key={cap.capability_key}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                  title={`Proficiency: ${cap.proficiency}`}
                >
                  {cap.capability_key}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">None reported</p>
          )}
        </div>

        {/* Heartbeat Metrics */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Live Metrics
            {hb && <span className="ml-1 text-muted-foreground/60 normal-case font-normal">(as of {fmtRelative(hb.recorded_at)})</span>}
          </p>
          {hb ? (
            <div className="space-y-2">
              <ResourceBar label="CPU" percent={cpuPct} colorClass={cpuPct > 80 ? 'bg-red-500' : 'bg-blue-500'} />
              <ResourceBar label="Memory" percent={memPct} colorClass={memPct > 85 ? 'bg-red-500' : 'bg-violet-500'} />
              <ResourceBar label="Disk Used" percent={diskPct} colorClass={diskPct > 90 ? 'bg-red-500' : 'bg-emerald-500'} />
              {diskFree !== null && (
                <p className="text-xs text-muted-foreground">{diskFree.toFixed(1)} GB free</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No heartbeat data</p>
          )}
        </div>
      </div>

      {/* Current Session */}
      {agent.current_session && (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Current Session</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-medium">{agent.current_session.task?.title ?? agent.current_session.id}</span>
            <Badge variant="outline" className="text-xs">{agent.current_session.status}</Badge>
            {agent.current_session.progress_percent > 0 && (
              <span className="text-muted-foreground">{agent.current_session.progress_percent}%</span>
            )}
            {agent.current_session.progress_message && (
              <span className="text-muted-foreground truncate max-w-xs">{agent.current_session.progress_message}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AgentWorkspacePage() {
  const { toast } = useToast();
  const { dashboard, agents, loading, refresh } = useAgentDashboard(15);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [deregisterTarget, setDeregisterTarget] = useState<EngineeringAgent | null>(null);
  const [deregistering, setDeregistering] = useState(false);
  const [secondsSince, setSecondsSince] = useState(0);

  // "Last updated X seconds ago" counter
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecondsSince(0);
    const t = setInterval(() => setSecondsSince((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [dashboard]);

  const handleDeregister = useCallback(async () => {
    if (!deregisterTarget) return;
    setDeregistering(true);
    try {
      await agentService.deregisterAgent(deregisterTarget.id);
      toast({ title: `Agent "${deregisterTarget.name}" deregistered` });
      setDeregisterTarget(null);
      if (selectedAgentId === deregisterTarget.id) setSelectedAgentId(null);
      refresh();
    } catch {
      toast({ title: 'Deregister failed', variant: 'destructive' });
    } finally {
      setDeregistering(false);
    }
  }, [deregisterTarget, selectedAgentId, refresh, toast]);

  const d = dashboard;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Workspace</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage connected engineering agents.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Updated {secondsSince}s ago
          </span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon="🟢"
          value={d?.connected_agents ?? null}
          label="Connected Agents"
          badgeClass={d && d.connected_agents > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}
        />
        <KpiCard
          icon="⚡"
          value={d?.busy_agents ?? null}
          label="Busy Agents"
          badgeClass="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        />
        <KpiCard
          icon="🔴"
          value={d?.offline_agents ?? null}
          label="Offline Agents"
          badgeClass={d && d.offline_agents > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}
        />
        <KpiCard
          icon="📋"
          value={d?.running_tasks ?? null}
          label="Running Tasks"
          badgeClass="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        />
      </div>

      {/* Agent Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full divide-y divide-border bg-card text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8 px-4 py-3" />
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Version</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Seen</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Current Task</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && agents.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  No agents registered. Connect an agent to get started.
                </td>
              </tr>
            ) : (
              agents.map((agent) => {
                const busy = agent.status === 'busy';
                const online = isOnline(agent);
                const dotColor = agentDotColor(agent);
                const isSelected = selectedAgentId === agent.id;

                return (
                  <React.Fragment key={agent.id}>
                    <tr
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/40',
                        isSelected && 'bg-muted/60'
                      )}
                      onClick={() => setSelectedAgentId(isSelected ? null : agent.id)}
                    >
                      {/* Status dot */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-block h-2.5 w-2.5 rounded-full',
                            dotColor,
                            busy && 'animate-pulse'
                          )}
                          title={agent.status}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{agent.name}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{agent.agent_type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{agent.version ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{agent.ip_address ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className={cn(!online && 'text-red-500 dark:text-red-400')}>
                          {fmtRelative(agent.last_seen_at)}
                        </span>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        {agent.current_session?.task?.title ? (
                          <span className="line-clamp-1 text-xs">{agent.current_session.task.title}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50 italic">Idle</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setSelectedAgentId(isSelected ? null : agent.id)}
                          >
                            {isSelected ? 'Collapse' : 'Details'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                            onClick={() => setDeregisterTarget(agent)}
                          >
                            Deregister
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline detail panel */}
                    {isSelected && (
                      <tr>
                        <td colSpan={8} className="px-4 pb-4 pt-0">
                          <AgentDetailPanel agent={agent} onClose={() => setSelectedAgentId(null)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Activity Feed */}
      {d && d.latest_activity.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Latest Activity</h2>
          <ol className="space-y-2">
            {d.latest_activity.slice(0, 10).map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-xs">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40 mt-1.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{item.agent_name}</span>
                  <span className="mx-1 text-muted-foreground">—</span>
                  <span>{item.event}</span>
                </div>
                <span className="shrink-0 text-muted-foreground">{fmtRelative(item.occurred_at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Deregister confirmation modal */}
      {deregisterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold">Deregister Agent</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Deregister <strong>{deregisterTarget.name}</strong>? The agent will be marked as terminated and won't accept new tasks.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" disabled={deregistering} onClick={() => setDeregisterTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deregistering}
                onClick={handleDeregister}
              >
                {deregistering ? 'Deregistering...' : 'Confirm Deregister'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
