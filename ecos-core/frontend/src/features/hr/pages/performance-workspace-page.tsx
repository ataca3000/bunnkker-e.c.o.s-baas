import { useState } from 'react';
import { Check, Pencil, RefreshCw, Sparkles, X } from 'lucide-react';

import { PageHeader, StatusBadge } from '@/components/crud';
import type { StatusVariant } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useDecideRecommendation,
  useEvaluatePerformance,
  useGenerateRecommendations,
  useGoalsQuery,
  useIncidentsQuery,
  useRecommendationsQuery,
} from '@/features/hr/hooks/use-compensation';

const currentMonth = () => new Date().toISOString().slice(0, 7);

const ACHIEVEMENT_TONE = (percent: number): string =>
  percent >= 100 ? 'text-emerald-600' : percent >= 80 ? 'text-amber-600' : 'text-red-600';

const STATUS_TONE: Record<string, StatusVariant> = {
  pending: 'pending',
  approved: 'active',
  modified: 'active',
  rejected: 'inactive',
};

/**
 * Performance Workspace — goals, the KPI evaluation, and the bonus decisions.
 *
 * The system measures and suggests; the manager approves, rejects or changes the
 * number. Only that decision creates a bonus.
 */
export function PerformanceWorkspacePage() {
  const [month, setMonth] = useState(currentMonth());
  const [modifying, setModifying] = useState<{ id: string; amount: string } | null>(null);

  const { data: goals } = useGoalsQuery({ period_month: month });
  const { data: recommendations, isLoading } = useRecommendationsQuery(month);
  const { data: incidents } = useIncidentsQuery();

  const evaluate = useEvaluatePerformance();
  const generate = useGenerateRecommendations();
  const decide = useDecideRecommendation();

  const items = recommendations?.items ?? [];
  const bands = recommendations?.bands ?? [];

  const submitModify = async () => {
    if (!modifying) return;
    await decide.mutateAsync({
      id: modifying.id,
      decision: 'modify',
      amount: Number(modifying.amount),
    });
    setModifying(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Performance"
        subtitle="Goals are measured from what the operational modules report — nobody enters their own score."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void evaluate.mutateAsync(month)}
              disabled={evaluate.isPending}
            >
              <RefreshCw className="size-4" />
              {evaluate.isPending ? 'Evaluating…' : 'Evaluate'}
            </Button>
            <Button size="sm" onClick={() => void generate.mutateAsync(month)} disabled={generate.isPending}>
              <Sparkles className="size-4" />
              Recommend Bonuses
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Goals Set</div>
            <div className="text-2xl font-bold">{goals?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Awaiting Decision</div>
            <div className="text-2xl font-bold text-amber-600">{isLoading ? '—' : items.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Recommended Total</div>
            <div className="text-2xl font-bold">
              {items.reduce((sum, r) => sum + r.recommended_amount, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Incidents</div>
            <div className="text-2xl font-bold">{incidents?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Bonus Recommendations</h2>
            {/* The bands are stated so the suggested number can be argued with. */}
            <div className="flex flex-wrap gap-2 text-xs">
              {bands.map((band) => (
                <span key={band.key} className="bg-muted rounded px-2 py-0.5">
                  {band.key} ≥ {band.min_achievement}% → {band.percent_of_basic}% of basic
                </span>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No recommendations for {month}. Evaluate the month first, then generate.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Employee</th>
                    <th className="py-2 pr-4 text-right font-medium">Achievement</th>
                    <th className="py-2 pr-4 font-medium">Band</th>
                    <th className="py-2 pr-4 text-right font-medium">Recommended</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((rec) => (
                    <tr key={rec.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{rec.employee?.name ?? '—'}</td>
                      <td className={`py-2 pr-4 text-right tabular-nums ${ACHIEVEMENT_TONE(rec.achievement_percent)}`}>
                        {rec.achievement_percent}%
                      </td>
                      <td className="text-muted-foreground py-2 pr-4">{rec.rule_key}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {rec.recommended_amount.toFixed(2)} {rec.currency}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={STATUS_TONE[rec.status] ?? 'pending'} label={rec.status} />
                      </td>
                      <td className="py-2 pr-4">
                        {modifying?.id === rec.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={modifying.amount}
                              onChange={(e) => setModifying({ ...modifying, amount: e.target.value })}
                              className="h-8 w-28"
                            />
                            <Button size="sm" onClick={() => void submitModify()}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setModifying(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void decide.mutateAsync({ id: rec.id, decision: 'approve' })}
                            >
                              <Check className="size-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setModifying({ id: rec.id, amount: rec.recommended_amount.toFixed(2) })
                              }
                            >
                              <Pencil className="size-3.5" />
                              Modify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void decide.mutateAsync({ id: rec.id, decision: 'reject' })}
                            >
                              <X className="size-3.5" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Goals for {month}</h2>
            {(goals ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No goals set for this month.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(goals ?? []).map((goal) => (
                  <li key={goal.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{goal.title}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {goal.metric_key} · {goal.subject_type}
                      </span>
                    </div>
                    <span className="text-sm tabular-nums">
                      {goal.lower_is_better ? '≤' : '≥'} {goal.target_value}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Recent Incidents</h2>
            {(incidents ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No incidents recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(incidents ?? []).slice(0, 8).map((incident) => (
                  <li key={incident.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${incident.is_positive ? 'text-emerald-600' : ''}`}>
                        {incident.category_label}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {incident.employee?.name ?? '—'} · {incident.occurred_on}
                        {incident.related_reference
                          ? ` · ${incident.related_module}/${incident.related_reference}`
                          : ''}
                      </span>
                    </div>
                    {incident.deduction_id ? (
                      <span className="text-xs text-red-600">deduction raised</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
