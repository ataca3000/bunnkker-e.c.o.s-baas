import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Box,
  CheckCircle2,
  Loader2,
  Package,
  ShoppingCart,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToastStore } from '@/components/ds/use-toast';
import {
  useProductWorkspace,
  useCompleteItem,
  useReportIssue,
} from '../hooks/use-preparation';
import type { PreparationIssueType } from '../types/preparation';

type Props = {
  waveId: string;
  itemId: string | null;
  onClose: () => void;
};

export function ProductWorkspaceDrawer({ waveId, itemId, onClose }: Props) {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const toast = useToastStore((s) => s.toast);
  const [activeTab, setActiveTab] = useState('overview');
  const [qtyPrepared, setQtyPrepared] = useState('');
  const [issueType, setIssueType] = useState<PreparationIssueType | ''>('');
  const [issueDesc, setIssueDesc] = useState('');

  const { data: workspace, isLoading } = useProductWorkspace(waveId, itemId);
  const completeItem = useCompleteItem();
  const reportIssue  = useReportIssue();

  const ISSUE_TYPES: PreparationIssueType[] = [
    'missing_material',
    'damaged_material',
    'quality_issue',
    'recipe_mismatch',
    'negative_stock',
    'manual_adjustment',
  ];

  function handleCompleteItem() {
    if (!itemId || !qtyPrepared) return;
    const qty = parseFloat(qtyPrepared);
    if (isNaN(qty) || qty < 0) {
      toast({ title: t($ => $.wave.drawer.toast.invalidQty), variant: 'destructive' });
      return;
    }
    completeItem.mutate(
      { waveId, itemId, payload: { quantity_prepared: qty } },
      {
        onSuccess: () => {
          toast({ title: t($ => $.wave.drawer.toast.itemPrepared) });
          setQtyPrepared('');
        },
        onError: () => toast({ title: t($ => $.wave.drawer.toast.error), description: t($ => $.wave.drawer.toast.failedUpdate), variant: 'destructive' }),
      },
    );
  }

  function handleReportIssue() {
    if (!itemId || !issueType || issueDesc.length < 10) {
      toast({ title: t($ => $.wave.drawer.toast.fillIssue), variant: 'destructive' });
      return;
    }
    reportIssue.mutate(
      { waveId, payload: { issue_type: issueType as PreparationIssueType, description: issueDesc, entity_type: 'product', entity_id: workspace?.item?.product_id } },
      {
        onSuccess: () => {
          toast({ title: t($ => $.wave.drawer.toast.issueReported) });
          setIssueType('');
          setIssueDesc('');
        },
        onError: () => toast({ title: t($ => $.wave.drawer.toast.error), description: t($ => $.wave.drawer.toast.failedReport), variant: 'destructive' }),
      },
    );
  }

  const item    = workspace?.item;
  const product = workspace?.product;
  const recipe  = workspace?.recipe;

  return (
    <Sheet open={!!itemId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-0 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {product?.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-12 w-12 rounded object-cover shrink-0 border"
                />
              ) : (
                <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <SheetTitle className="text-base leading-tight">
                  {item?.name_snapshot ?? t($ => $.wave.drawer.loading)}
                </SheetTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{item?.sku}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress bar */}
          {item && (
            <div className="flex items-center gap-3 mt-3 pb-4 border-b">
              <Progress value={item.completion_pct} className="h-2 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                {item.quantity_prepared}/{item.quantity_required} {product?.unit_symbol}
              </span>
              <Badge className={
                item.status === 'prepared'    ? 'bg-green-100 text-green-700' :
                item.status === 'short'       ? 'bg-amber-100 text-amber-700' :
                item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }>
                {item.status}
              </Badge>
            </div>
          )}
        </SheetHeader>

        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && workspace && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-3 grid grid-cols-4 shrink-0">
              <TabsTrigger value="overview">{t($ => $.wave.drawer.tabs.overview)}</TabsTrigger>
              <TabsTrigger value="recipe">
                {t($ => $.wave.drawer.tabs.recipe)}
                {recipe ? ` (${recipe.material_lines.length})` : ''}
              </TabsTrigger>
              <TabsTrigger value="orders">{t($ => $.wave.drawer.tabs.orders)} ({workspace.orders.length})</TabsTrigger>
              <TabsTrigger value="issues">{t($ => $.wave.drawer.tabs.issues)}</TabsTrigger>
            </TabsList>

            {/* Overview tab — complete item */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">{t($ => $.wave.drawer.overview.required)}</p>
                  <p className="text-lg font-semibold">{item?.quantity_required} <span className="text-xs font-normal text-muted-foreground">{product?.unit_symbol}</span></p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">{t($ => $.wave.drawer.overview.prepared)}</p>
                  <p className="text-lg font-semibold">{item?.quantity_prepared} <span className="text-xs font-normal text-muted-foreground">{product?.unit_symbol}</span></p>
                </div>
              </div>

              {(item?.quantity_short ?? 0) > 0 && (
                <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{item?.quantity_short} {product?.unit_symbol} {t($ => $.wave.drawer.overview.short)}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t($ => $.wave.drawer.overview.markPreparedQty)}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder={tAny('wave.drawer.overview.maxPlaceholder', { max: item?.quantity_required })}
                    value={qtyPrepared}
                    onChange={(e) => setQtyPrepared(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleCompleteItem}
                    disabled={!qtyPrepared || completeItem.isPending}
                  >
                    {completeItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="ml-1.5">{t($ => $.wave.drawer.overview.markButton)}</span>
                  </Button>
                </div>
              </div>

              {/* Materials summary */}
              {workspace.materials.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{t($ => $.wave.drawer.overview.materialsHeader)}</h4>
                  <div className="divide-y rounded border text-sm">
                    {workspace.materials.map((m: (typeof workspace.materials)[0]) => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs font-mono text-muted-foreground">{m.raw_material_id.slice(0, 8)}…</span>
                        <div className="flex items-center gap-2">
                          {m.shortage_flag && (
                            <Badge className="bg-red-100 text-red-700 text-[10px]">{t($ => $.wave.drawer.overview.shortBadge)} {m.shortage_qty}</Badge>
                          )}
                          <span className="text-xs">{m.quantity_on_hand} / {m.quantity_needed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Recipe tab */}
            <TabsContent value="recipe" className="flex-1 overflow-y-auto px-6 py-4">
              {!recipe ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <BookOpen className="h-8 w-8 opacity-30" />
                  <p className="text-sm">{t($ => $.wave.drawer.recipe.noRecipe)}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recipe.recipe_cost != null && (
                    <div className="flex items-center justify-between rounded border p-3 text-sm">
                      <span className="text-muted-foreground">{t($ => $.wave.drawer.recipe.recipeCost)}</span>
                      <span className="font-medium">{recipe.recipe_cost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="divide-y rounded border text-sm">
                    {recipe.material_lines.map((line: (typeof recipe.material_lines)[0]) => (
                      <div key={line.id} className="flex items-center gap-3 px-3 py-2">
                        <Box className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{line.material_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{line.material_sku}</p>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-xs font-medium">{line.quantity} {line.unit_symbol}</p>
                          {line.waste_percentage > 0 && (
                            <p className="text-[10px] text-amber-600">+{line.waste_percentage}% {t($ => $.wave.drawer.recipe.wastePercentage)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Orders tab */}
            <TabsContent value="orders" className="flex-1 overflow-y-auto px-6 py-4">
              {workspace.orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 opacity-30" />
                  <p className="text-sm">{t($ => $.wave.drawer.orders.empty)}</p>
                </div>
              ) : (
                <div className="divide-y rounded border text-sm">
                  {workspace.orders.map((o: (typeof workspace.orders)[0]) => (
                    <div key={o.order_id} className="flex items-center justify-between px-3 py-2">
                      <div>
                        <p className="text-xs font-mono font-medium">{o.order_number}</p>
                        <p className="text-[10px] text-muted-foreground">{o.customer_name ?? '—'}</p>
                      </div>
                      <div className="text-end">
                        <p className="text-xs font-medium">{o.quantity} {product?.unit_symbol}</p>
                        <p className="text-[10px] text-muted-foreground">{o.delivery_zone ?? '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Issues tab — report issue */}
            <TabsContent value="issues" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label>{t($ => $.wave.drawer.issues.issueTypeLabel)} <span className="text-destructive">*</span></Label>
                <Select value={issueType} onValueChange={(v) => setIssueType(v as PreparationIssueType)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t($ => $.wave.drawer.issues.issueTypePlaceholder)} />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_TYPES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {tAny(`wave.drawer.issueTypes.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t($ => $.wave.drawer.issues.descriptionLabel)} <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder={t($ => $.wave.drawer.issues.descriptionPlaceholder)}
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  rows={4}
                />
                <p className="text-[10px] text-muted-foreground">{issueDesc.length}/2000</p>
              </div>

              <Button
                onClick={handleReportIssue}
                disabled={!issueType || issueDesc.length < 10 || reportIssue.isPending}
                variant="destructive"
                className="w-full"
              >
                {reportIssue.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                {t($ => $.wave.drawer.issues.reportButton)}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
