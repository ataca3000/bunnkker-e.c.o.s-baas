import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Zap, AlertTriangle, CheckCircle, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutomationWorkflow, useActivateWorkflow, usePauseWorkflow } from '../hooks/use-automation-workflows';
import { useWorkflowVersions } from '../hooks/use-workflow-versions';
import { useWorkflowExecutions } from '../hooks/use-workflow-executions';
import { useSimulateWorkflow } from '../hooks/use-workflow-simulation';
import type { WorkflowVersion } from '../types/automation';
import { ROUTES } from '@/router/routes';

type PanelTab = 'executions' | 'versions' | 'simulation';

export function WorkflowBuilderPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const [panelTab, setPanelTab] = useState<PanelTab>('executions');
  const [simulationResult, setSimulationResult] = useState<ReturnType<typeof useSimulateWorkflow>['data']>(undefined);

  const { data: workflow, isLoading } = useAutomationWorkflow(workflowId!);
  const { data: versionsData }        = useWorkflowVersions(workflowId!);
  const { data: executionsData }      = useWorkflowExecutions(workflowId!);
  const simulate                      = useSimulateWorkflow(workflowId!);
  const activate                      = useActivateWorkflow();
  const pause                         = usePauseWorkflow();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading workflow...</div>;
  }

  if (!workflow) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Workflow not found.</div>;
  }

  const versions   = versionsData ?? [];
  const executions = executionsData?.data ?? [];

  async function handleSimulate() {
    const result = await simulate.mutateAsync({});
    setSimulationResult(result);
    setPanelTab('simulation');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(ROUTES.automationWorkspace)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-semibold">{workflow.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground capitalize">{workflow.status.replace('_', ' ')}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">v{workflow.version_number}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground capitalize">{workflow.trigger_type.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSimulate} disabled={simulate.isPending}>
            <Zap className="h-3.5 w-3.5 mr-1" />
            {simulate.isPending ? 'Simulating...' : 'Simulate'}
          </Button>
          {workflow.can_activate && (
            <Button size="sm" onClick={() => activate.mutate(workflow.id)} disabled={activate.isPending}>
              <Play className="h-3.5 w-3.5 mr-1" /> Activate
            </Button>
          )}
          {workflow.can_pause && (
            <Button variant="outline" size="sm" onClick={() => pause.mutate(workflow.id)} disabled={pause.isPending}>
              <Pause className="h-3.5 w-3.5 mr-1" /> Pause
            </Button>
          )}
        </div>
      </div>

      {/* Main content: canvas placeholder + side panel */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center bg-muted/30 border-r relative">
          <div className="text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Workflow Canvas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Visual canvas editor coming soon.
            </p>
            <div className="mt-4 p-3 bg-card border rounded-lg text-start max-w-sm">
              <p className="text-xs font-medium mb-1">Current Graph</p>
              <p className="text-xs text-muted-foreground">
                {workflow.nodes_graph?.nodes?.length ?? 0} nodes ·{' '}
                {workflow.nodes_graph?.edges?.length ?? 0} edges
              </p>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-80 flex flex-col border-l">
          {/* Panel tabs */}
          <div className="flex border-b">
            {(['executions', 'versions', 'simulation'] as PanelTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                className={`flex-1 text-xs py-2 capitalize transition-colors ${
                  panelTab === tab
                    ? 'border-b-2 border-primary text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Executions panel */}
            {panelTab === 'executions' && (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  {executions.length} recent executions
                </p>
                {executions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No executions yet</p>
                ) : (
                  executions.map(exec => (
                    <div key={exec.id} className="p-2 bg-muted/40 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs truncate">{exec.id.slice(0, 8)}...</span>
                        <span className={`capitalize ${exec.status === 'completed' ? 'text-green-600' : exec.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {exec.status}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {exec.entity_type} · {exec.step_count} steps
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Versions panel */}
            {panelTab === 'versions' && (
              <>
                <p className="text-xs text-muted-foreground mb-2">Version history</p>
                {versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No versions yet</p>
                ) : (
                  versions.map((v: WorkflowVersion) => (
                    <div key={v.id} className="p-2 bg-muted/40 rounded text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">v{v.version_number}</span>
                        <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                      </div>
                      {v.change_note && (
                        <p className="text-muted-foreground mt-0.5 truncate">{v.change_note}</p>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {/* Simulation panel */}
            {panelTab === 'simulation' && (
              <>
                {!simulationResult ? (
                  <div className="text-center py-6">
                    <Zap className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Click Simulate to preview execution</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 p-2 rounded text-xs ${simulationResult.can_activate ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {simulationResult.can_activate
                        ? <><CheckCircle className="h-3.5 w-3.5" /> Ready to activate</>
                        : <><AlertTriangle className="h-3.5 w-3.5" /> Has issues</>
                      }
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nodes</span>
                        <span>{simulationResult.total_nodes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Actions</span>
                        <span>{simulationResult.action_nodes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Est. volume</span>
                        <span>{simulationResult.estimated_volume.toLocaleString()}</span>
                      </div>
                    </div>
                    {simulationResult.warnings.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-yellow-700">Warnings</p>
                        {simulationResult.warnings.map((w, i) => (
                          <div key={i} className="flex gap-1.5 text-xs text-yellow-600">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {simulationResult.expected_actions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Expected Actions</p>
                        {simulationResult.expected_actions.map(a => (
                          <div key={a.node_id} className="text-xs p-1.5 bg-muted/40 rounded mb-1">
                            <span className="font-medium capitalize">{a.action_type?.replace(/_/g, ' ')}</span>
                            {a.label !== a.action_type && <span className="text-muted-foreground ml-1">({a.label})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

