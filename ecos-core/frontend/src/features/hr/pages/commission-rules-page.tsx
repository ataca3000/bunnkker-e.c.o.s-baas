import { useState } from 'react';
import { Plus } from 'lucide-react';

import { EntityDrawer, PageHeader, StatusBadge } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCommissionRulesQuery,
  useCreateCommissionRule,
  useKpiMetricsQuery,
} from '@/features/hr/hooks/use-compensation';
import type { CommissionMethod } from '@/features/hr/types/compensation';

const METHODS: Array<{ value: CommissionMethod; label: string; hint: string }> = [
  { value: 'percentage_of_value', label: 'Percentage of Value', hint: 'e.g. 2% of sales amount' },
  { value: 'amount_per_unit', label: 'Amount per Unit', hint: 'e.g. a fixed amount per delivered shipment' },
  { value: 'tiered', label: 'Tiered', hint: 'banded rates by achieved value' },
];

/**
 * Commission Rules Engine.
 *
 * A sales percentage and a per-delivery rate are the same rule with different
 * settings — which is why a new scheme is a row here rather than a deployment.
 */
export function CommissionRulesPage() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    metric_key: '',
    method: 'percentage_of_value' as CommissionMethod,
    rate: '',
    threshold_value: '',
    max_amount: '',
  });

  const { data: rules, isLoading } = useCommissionRulesQuery();
  const { data: metrics } = useKpiMetricsQuery();
  const create = useCreateCommissionRule();

  const selectedMetric = (metrics ?? []).find((m) => m.key === form.metric_key);
  const selectedMethod = METHODS.find((m) => m.value === form.method);

  const submit = async () => {
    setError(null);

    if (!form.code || !form.name || !form.metric_key) {
      setError('A code, a name and a metric are required.');
      return;
    }

    try {
      await create.mutateAsync({
        code: form.code,
        name: form.name,
        metric_key: form.metric_key,
        method: form.method,
        rate: form.rate ? Number(form.rate) : undefined,
        threshold_value: form.threshold_value ? Number(form.threshold_value) : undefined,
        max_amount: form.max_amount ? Number(form.max_amount) : undefined,
        applies_to: 'all',
      });
      setForm({ ...form, code: '', name: '', rate: '', threshold_value: '', max_amount: '' });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The rule could not be saved.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Commission Rules"
        subtitle="Which metric a rule measures, how it pays, and at what rate — configuration, never code."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New Rule
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Rules</div>
            <div className="text-2xl font-bold">{isLoading ? '—' : (rules?.length ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Active</div>
            <div className="text-2xl font-bold text-emerald-600">
              {(rules ?? []).filter((r) => r.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Metrics Available</div>
            <div className="text-2xl font-bold">{metrics?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {(rules ?? []).length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No commission rules yet. A rule names a metric, a method and a rate.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Metric</th>
                    <th className="py-2 pr-4 font-medium">Method</th>
                    <th className="py-2 pr-4 text-right font-medium">Rate</th>
                    <th className="py-2 pr-4 font-medium">Applies To</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(rules ?? []).map((rule) => (
                    <tr key={rule.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{rule.code}</td>
                      <td className="py-2 pr-4 font-medium">{rule.name}</td>
                      <td className="text-muted-foreground py-2 pr-4 font-mono text-xs">{rule.metric_key}</td>
                      <td className="py-2 pr-4">{rule.method_label}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {rule.method === 'percentage_of_value'
                          ? `${rule.rate}%`
                          : rule.method === 'amount_per_unit'
                            ? rule.rate.toFixed(2)
                            : `${rule.tiers.length} tiers`}
                      </td>
                      <td className="text-muted-foreground py-2 pr-4">{rule.applies_to_label}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={rule.is_active ? 'active' : 'inactive'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EntityDrawer
        open={open}
        onOpenChange={setOpen}
        title="New Commission Rule"
        description="The metric is measured from what the operational modules report — nobody enters their own figure."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Create Rule'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule_code">Code</Label>
              <Input id="rule_code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule_name">Name</Label>
              <Input id="rule_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule_metric">Metric</Label>
            <select
              id="rule_metric"
              value={form.metric_key}
              onChange={(e) => setForm({ ...form, metric_key: e.target.value })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">Choose a metric…</option>
              {(metrics ?? []).map((metric) => (
                <option key={metric.key} value={metric.key}>
                  {metric.label} ({metric.module})
                </option>
              ))}
            </select>
            {selectedMetric ? (
              <span className="text-muted-foreground text-xs">
                Measured in {selectedMetric.unit}, collected from {selectedMetric.module}.
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule_method">Method</Label>
            <select
              id="rule_method"
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as CommissionMethod })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              {METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            {selectedMethod ? (
              <span className="text-muted-foreground text-xs">{selectedMethod.hint}</span>
            ) : null}
          </div>

          {form.method !== 'tiered' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule_rate">
                {form.method === 'percentage_of_value' ? 'Rate (%)' : 'Amount per unit'}
              </Label>
              <Input
                id="rule_rate"
                type="number"
                step="0.01"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Tiered rules are configured with their bands via the API; the flat rate does not apply.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule_threshold">Threshold</Label>
              <Input
                id="rule_threshold"
                type="number"
                step="0.01"
                value={form.threshold_value}
                onChange={(e) => setForm({ ...form, threshold_value: e.target.value })}
                placeholder="Pays nothing below this"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule_cap">Maximum</Label>
              <Input
                id="rule_cap"
                type="number"
                step="0.01"
                value={form.max_amount}
                onChange={(e) => setForm({ ...form, max_amount: e.target.value })}
                placeholder="Optional cap"
              />
            </div>
          </div>
        </div>
      </EntityDrawer>
    </div>
  );
}
