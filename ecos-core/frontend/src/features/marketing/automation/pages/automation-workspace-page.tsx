import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Pause, Archive, Copy, MoreHorizontal, Zap, Activity, Clock, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAutomationWorkflows, useWorkflowKpis, useActivateWorkflow, usePauseWorkflow, useArchiveWorkflow, useDuplicateWorkflow } from '../hooks/use-automation-workflows';
import { WorkflowDrawer } from '../drawers/workflow-drawer';
import { WorkflowTemplatePicker } from '../drawers/workflow-template-picker';
import type { AutomationWorkflow, WorkflowStatus } from '../types/automation';
import { ROUTES } from '@/router/routes';

const STATUS_TABS: (WorkflowStatus | 'all')[] = [
  'all',
  'draft',
  'active',
  'paused',
  'pending_approval',
  'archived',
];

const STATUS_BADGE: Record<WorkflowStatus, string> = {
  draft:            'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved:         'bg-blue-100 text-blue-700',
  active:           'bg-green-100 text-green-700',
  paused:           'bg-orange-100 text-orange-700',
  archived:         'bg-gray-200 text-gray-500',
  failed:           'bg-red-100 text-red-700',
};

function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-card border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function WorkflowCard({ workflow, onOpen }: { workflow: AutomationWorkflow; onOpen: () => void }) {
  const { t }     = useTranslation('marketing');
  const activate  = useActivateWorkflow();
  const pause     = usePauseWorkflow();
  const archive   = useArchiveWorkflow();
  const duplicate = useDuplicateWorkflow();
  const navigate  = useNavigate();

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => navigate(ROUTES.workflowBuilder.replace(':workflowId', workflow.id))}
            className="text-sm font-medium hover:underline truncate text-start block"
          >
            {workflow.name}
          </button>
          {workflow.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{workflow.description}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>{t($ => $.automation.workflows.actions.editDetails)}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(ROUTES.workflowBuilder.replace(':workflowId', workflow.id))}>
              {t($ => $.automation.workflows.actions.openBuilder)}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicate.mutate(workflow.id)}>
              <Copy className="h-3.5 w-3.5 me-2" /> {t($ => $.automation.workflows.actions.duplicate)}
            </DropdownMenuItem>
            {workflow.can_activate && (
              <DropdownMenuItem onClick={() => activate.mutate(workflow.id)}>
                <Play className="h-3.5 w-3.5 me-2" /> {t($ => $.automation.workflows.actions.activate)}
              </DropdownMenuItem>
            )}
            {workflow.can_pause && (
              <DropdownMenuItem onClick={() => pause.mutate(workflow.id)}>
                <Pause className="h-3.5 w-3.5 me-2" /> {t($ => $.automation.workflows.actions.pause)}
              </DropdownMenuItem>
            )}
            {workflow.can_archive && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => archive.mutate(workflow.id)}
              >
                <Archive className="h-3.5 w-3.5 me-2" /> {t($ => $.automation.workflows.actions.archive)}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[workflow.status]}`}>
          {t($ => $.automation.workflowStatus[workflow.status], { defaultValue: workflow.status })}
        </span>
        <span className="text-xs text-muted-foreground">
          {t($ => $.automation.triggerType[workflow.trigger_type], { defaultValue: workflow.trigger_type })}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span>{t($ => $.automation.dashboard.trending.runs, { count: workflow.execution_count })}</span>
        {workflow.last_executed_at && (
          <span>{t($ => $.automation.workflows.lastRun, { date: new Date(workflow.last_executed_at).toLocaleDateString() })}</span>
        )}
      </div>
    </div>
  );
}

export function AutomationWorkspacePage() {
  const { t } = useTranslation('marketing');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AutomationWorkflow | undefined>();

  const { data: kpis }      = useWorkflowKpis();
  const { data, isLoading } = useAutomationWorkflows({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  const workflows = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">{t($ => $.automation.workflows.title)}</h1>
          <p className="text-xs text-muted-foreground">{t($ => $.automation.workflows.subtitle)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTemplatePickerOpen(true)}>
            {t($ => $.automation.workflows.actions.templates)}
          </Button>
          <Button size="sm" onClick={() => { setSelectedWorkflow(undefined); setDrawerOpen(true); }}>
            <Plus className="h-3.5 w-3.5 me-1" /> {t($ => $.automation.workflows.actions.new)}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b">
          <KpiCard icon={Activity}  label={t($ => $.automation.dashboard.kpis.activeWorkflows)} value={kpis.active}   color="bg-green-50 text-green-600" />
          <KpiCard icon={Zap}       label={t($ => $.automation.dashboard.kpis.totalExecutions)} value={kpis.total_executions} color="bg-blue-50 text-blue-600" />
          <KpiCard icon={Clock}     label={t($ => $.automation.workflowStatus.pending_approval)} value={kpis.pending_approval} color="bg-yellow-50 text-yellow-600" />
          <KpiCard icon={XCircle}   label={t($ => $.automation.executionStatus.failed)}          value={kpis.failed}   color="bg-red-50 text-red-600" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b">
        <Input
          placeholder={t($ => $.automation.workflows.search)}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 w-64"
        />
        <div className="flex gap-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                statusFilter === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab === 'all' ? t($ => $.common.all) : t($ => $.automation.workflowStatus[tab])}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t($ => $.automation.workflows.loading)}</div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Zap className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t($ => $.automation.workflows.empty)}</p>
            <Button size="sm" onClick={() => setTemplatePickerOpen(true)}>{t($ => $.automation.workflows.actions.browseTemplates)}</Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {workflows.map(wf => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onOpen={() => { setSelectedWorkflow(wf); setDrawerOpen(true); }}
              />
            ))}
          </div>
        )}
      </div>

      <WorkflowDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedWorkflow(undefined); }}
        workflow={selectedWorkflow}
      />

      <WorkflowTemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
      />
    </div>
  );
}

