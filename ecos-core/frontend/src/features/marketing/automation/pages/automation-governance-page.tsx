import { useState } from 'react';
import { Plus, Shield, MoreHorizontal, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useGovernancePolicies, useDeleteGovernancePolicy } from '../hooks/use-automation-governance';
import type { AutomationGovernancePolicy } from '../types/automation';

function PolicyCard({
  policy,
  onEdit,
  onDelete,
}: {
  policy: AutomationGovernancePolicy;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('marketing');

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{policy.name}</span>
              {policy.is_default && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="h-2.5 w-2.5" /> {t($ => $.common.default)}
                </span>
              )}
            </div>
            {policy.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{policy.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>{t($ => $.common.edit)}</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              {t($ => $.common.deactivate)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1 mt-3 text-xs">
        {policy.max_executions_per_customer_per_day != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t($ => $.automation.governance.limits.perCustomerPerDay)}</span>
            <span className="font-medium">{policy.max_executions_per_customer_per_day}</span>
          </div>
        )}
        {policy.max_executions_per_customer_per_workflow != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t($ => $.automation.governance.limits.perCustomerPerWorkflow)}</span>
            <span className="font-medium">{policy.max_executions_per_customer_per_workflow}</span>
          </div>
        )}
        {policy.max_total_executions_per_day != null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t($ => $.automation.governance.limits.totalPerDay)}</span>
            <span className="font-medium">{policy.max_total_executions_per_day}</span>
          </div>
        )}
        {policy.quiet_hours_start && policy.quiet_hours_end && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t($ => $.automation.governance.limits.quietHours)}</span>
            <span className="font-medium">{policy.quiet_hours_start} – {policy.quiet_hours_end}</span>
          </div>
        )}
        {policy.requires_approval && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t($ => $.automation.governance.limits.requiresApproval)}</span>
            <span className="font-medium text-yellow-600">{t($ => $.common.yes)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AutomationGovernancePage() {
  const { t } = useTranslation('marketing');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected]     = useState<AutomationGovernancePolicy | undefined>();

  const { data, isLoading } = useGovernancePolicies();
  const deletePolicy        = useDeleteGovernancePolicy();

  const policies = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">{t($ => $.automation.governance.title)}</h1>
          <p className="text-xs text-muted-foreground">{t($ => $.automation.governance.subtitle)}</p>
        </div>
        <Button size="sm" onClick={() => { setSelected(undefined); setDrawerOpen(true); }}>
          <Plus className="h-3.5 w-3.5 me-1" /> {t($ => $.automation.governance.actions.new)}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t($ => $.automation.governance.loading)}</div>
        ) : policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Shield className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t($ => $.automation.governance.empty)}</p>
            <Button size="sm" onClick={() => setDrawerOpen(true)}>{t($ => $.automation.governance.actions.create)}</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {policies.map(policy => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onEdit={() => { setSelected(policy); setDrawerOpen(true); }}
                onDelete={() => deletePolicy.mutate(policy.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inline form placeholder — full drawer can be added in a follow-up */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDrawerOpen(false)}>
          <div className="bg-card rounded-lg p-6 w-96" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">{selected ? t($ => $.automation.governance.actions.edit) : t($ => $.automation.governance.actions.newFull)}</h3>
            <p className="text-xs text-muted-foreground">{t($ => $.automation.governance.formPlaceholder)}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setDrawerOpen(false)}>
              {t($ => $.common.close)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

