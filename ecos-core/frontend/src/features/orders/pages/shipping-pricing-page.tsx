import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ds/use-toast';
import { ordersService } from '@/features/orders/services/orders-service';
import type { ShippingPricingRule } from '@/features/orders/types/order';
import { ROUTES } from '@/router/routes';

const RULES_KEY = 'shipping-pricing-rules';

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type RuleFormState = {
  id?: string;
  governorate: string;
  city: string;
  area: string;
  standard_cost: string;
  express_cost: string;
  is_active: boolean;
};

const emptyForm = (): RuleFormState => ({
  governorate: '',
  city: '',
  area: '',
  standard_cost: '',
  express_cost: '',
  is_active: true,
});

export function ShippingPricingPage() {
  const { t } = useTranslation('orders');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<RuleFormState | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: [RULES_KEY],
    queryFn: () => ordersService.listShippingRules(),
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: (payload: Omit<ShippingPricingRule, 'id'>) =>
      fetch('/api/shipping-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
      setFormState(null);
      toast({ type: 'success', title: t($ => $.shippingPricing.ruleCreated) });
    },
    onError: () => toast({ type: 'error', title: t($ => $.shippingPricing.saveFailed) }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/shipping-pricing/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
      toast({ type: 'success', title: t($ => $.shippingPricing.ruleDeleted) });
    },
    onError: () => toast({ type: 'error', title: t($ => $.shippingPricing.deleteFailed) }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState) return;
    create.mutate({
      company_id: null,
      governorate: formState.governorate,
      city: formState.city || null,
      area: formState.area || null,
      standard_cost: Number(formState.standard_cost),
      express_cost: formState.express_cost ? Number(formState.express_cost) : null,
      is_active: formState.is_active,
    } as Omit<ShippingPricingRule, 'id'>);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.shippingPricing.title)}
        subtitle={t($ => $.shippingPricing.subtitle)}
        breadcrumbs={[
          { label: t($ => $.shippingPricing.breadcrumbHome), to: ROUTES.dashboard },
          { label: t($ => $.shippingPricing.breadcrumbTitle) },
        ]}
        actions={
          <Button onClick={() => setFormState(emptyForm())}>
            <Plus className="size-4" />
            {t($ => $.shippingPricing.addRule)}
          </Button>
        }
      />

      {/* Inline form */}
      {formState && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{t($ => $.shippingPricing.governorateLabel)}</label>
                <Input
                  required
                  value={formState.governorate}
                  onChange={(e) => setFormState((s) => s && { ...s, governorate: e.target.value })}
                  placeholder="e.g. Cairo"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t($ => $.shippingPricing.cityLabel)}</label>
                <Input
                  value={formState.city}
                  onChange={(e) => setFormState((s) => s && { ...s, city: e.target.value })}
                  placeholder={t($ => $.shippingPricing.cityPlaceholder)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t($ => $.shippingPricing.areaLabel)}</label>
                <Input
                  value={formState.area}
                  onChange={(e) => setFormState((s) => s && { ...s, area: e.target.value })}
                  placeholder={t($ => $.shippingPricing.areaPlaceholder)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t($ => $.shippingPricing.standardCostLabel)}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formState.standard_cost}
                  onChange={(e) => setFormState((s) => s && { ...s, standard_cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{t($ => $.shippingPricing.expressCostLabel)}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.express_cost}
                  onChange={(e) => setFormState((s) => s && { ...s, express_cost: e.target.value })}
                  placeholder={t($ => $.shippingPricing.optional)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? t($ => $.shippingPricing.saving) : t($ => $.shippingPricing.saveRule)}
                </Button>
                <Button type="button" variant="outline" onClick={() => setFormState(null)}>
                  {t($ => $.shippingPricing.cancel)}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rules table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">{t($ => $.shippingPricing.loading)}</p>
          ) : rules.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t($ => $.shippingPricing.noRules)}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{t($ => $.shippingPricing.colGovernorate)}</th>
                    <th className="px-4 py-3 font-medium">{t($ => $.shippingPricing.colCity)}</th>
                    <th className="px-4 py-3 font-medium">{t($ => $.shippingPricing.colArea)}</th>
                    <th className="px-4 py-3 font-medium">{t($ => $.shippingPricing.colStandardCost)}</th>
                    <th className="px-4 py-3 font-medium">{t($ => $.shippingPricing.colExpressCost)}</th>
                    <th className="px-4 py-3 font-medium">{t($ => $.shippingPricing.colActive)}</th>
                    <th className="w-20 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{rule.governorate}</td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.city ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{rule.area ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums">{fmt(rule.standard_cost)}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {rule.express_cost != null ? fmt(rule.express_cost) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            rule.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {rule.is_active ? t($ => $.shippingPricing.active) : t($ => $.shippingPricing.inactive)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() =>
                              setFormState({
                                id: rule.id,
                                governorate: rule.governorate,
                                city: rule.city ?? '',
                                area: rule.area ?? '',
                                standard_cost: String(rule.standard_cost),
                                express_cost: rule.express_cost != null ? String(rule.express_cost) : '',
                                is_active: rule.is_active,
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive size-7"
                            onClick={() => remove.mutate(rule.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
