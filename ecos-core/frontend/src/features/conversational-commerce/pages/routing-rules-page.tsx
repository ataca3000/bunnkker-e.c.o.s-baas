import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, GitBranch, CheckCircle2, XCircle } from 'lucide-react';
import { useRoutingRules, useDeleteRoutingRule } from '../hooks/use-routing-rules';
import type { RoutingType } from '../types/conversation';

const ROUTING_TYPE_LABELS: Record<RoutingType, string> = {
  auto: 'Auto',
  round_robin: 'Round Robin',
  skill_based: 'Skill Based',
  manual: 'Manual',
};

export function RoutingRulesPage() {
  const { data, isLoading } = useRoutingRules();
  const rules = data?.data ?? [];
  const deleteRule = useDeleteRoutingRule();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Routing Rules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-assign conversations based on conditions
          </p>
        </div>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          New Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <GitBranch className="w-10 h-10" />
          <p className="font-medium">No routing rules</p>
          <p className="text-sm">Rules are evaluated in order of priority</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {rules.map((rule) => (
            <div key={rule.id} className="p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-bold">
                {rule.priority}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{rule.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {ROUTING_TYPE_LABELS[rule.routing_type]}
                  </Badge>
                  {rule.is_active ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                  {rule.assign_to_user_id && ' · Assigns to agent'}
                  {rule.assign_to_team_id && ' · Assigns to team'}
                  {rule.set_priority && ` · Sets priority: ${rule.set_priority}`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteRule.mutate(rule.id)}
                disabled={deleteRule.isPending}
                className="flex-shrink-0"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
