import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller, FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { SubmitHandler, UseFormReturn } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  AlertCircle,
  Copy,
  Eye,
  Package,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import { Combobox, FormField, PageHeader } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ds/use-toast';
import { useCreateRawMaterial } from '@/features/raw-materials/hooks/use-raw-materials';
import { useCategoriesQuery } from '@/features/categories/hooks/use-categories';
import { useUnitsQuery } from '@/features/units/hooks/use-units';
import { useCreateRecipe, useRecipeQuery, useRecipesQuery, useUpdateRecipe } from '@/features/recipes/hooks/use-recipes';
import { useCompanyOptions } from '@/features/channels/hooks/use-company-options';
import { channelsService } from '@/features/channels/services/channels-service';
import { recipesService } from '@/features/recipes/services/recipes-service';
import {
  recipeFormSchema,
  type RecipeFormValues,
} from '@/features/recipes/schemas/recipe-form-schema';
import type { Recipe } from '@/features/recipes/types/recipe';
import { RawMaterialDetailDrawer } from '@/features/products/components/raw-material-detail-drawer';
import type { Product } from '@/features/products/types/product';
import type { RawMaterial } from '@/features/raw-materials/types';
import { useProductsQuery } from '@/features/products/hooks/use-products';
import { useCompany } from '@/features/organization/context/company-context';
import { formatMoney } from '@/lib/format';
import { calcRecipeCostFromFormLines } from '@/lib/recipe-cost-calculator';
import { LiveCostBadge } from '@/components/ui/live-cost-badge';
import { getMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/router/routes';

const FORM_ID = 'recipe-form';

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'An error occurred. Please try again.';
}

function fmt(value: number, decimals = 2): string {
  return value.toLocaleString('en-EG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCost(n: number, currency: string, locale = 'en-EG'): string {
  return formatMoney(n, currency, locale);
}

function MaterialTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation('recipes');
  if (type === 'packaging_material') {
    return (
      <Badge variant="outline" className="text-xs border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400">
        {t($ => $.materialTypes.packaging)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-400">
      {t($ => $.materialTypes.rawMaterial)}
    </Badge>
  );
}

function LabelValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</span>
      <span className="text-sm">{value ?? '—'}</span>
    </div>
  );
}

function WorkspaceCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Quick Material Creation Dialog ──────────────────────────────────────────

type QuickMaterialDialogProps = {
  open:        boolean;
  onOpenChange:(open: boolean) => void;
  defaultType: 'raw_material' | 'packaging_material';
  onCreated:   (product: Product) => void;
};

function QuickMaterialDialog({ open, onOpenChange, defaultType, onCreated }: QuickMaterialDialogProps) {
  const { t } = useTranslation('recipes');
  const createMaterial = useCreateRawMaterial();
  const { data: categoriesResult } = useCategoriesQuery({ status: 'active', per_page: 200 });
  const { data: unitsResult }      = useUnitsQuery({ per_page: 200 });

  const categories = categoriesResult?.items ?? [];
  const units      = unitsResult?.items ?? [];

  const [name,       setName]       = useState('');
  const [type,       setType]       = useState<'raw_material' | 'packaging_material'>(defaultType);
  const [categoryId, setCategoryId] = useState('');
  const [unitId,     setUnitId]     = useState('');
  const [error,      setError]      = useState('');

  function reset() {
    setName(''); setType(defaultType); setCategoryId(''); setUnitId(''); setError('');
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleSave() {
    if (!name.trim())    { setError(t($ => $.createMaterial.nameRequired));      return; }
    if (!categoryId)     { setError(t($ => $.createMaterial.categoryRequired)); return; }
    if (!unitId)         { setError(t($ => $.createMaterial.unitRequired));     return; }

    setError('');
    createMaterial.mutate(
      {
        sku:          '',
        name:         name.trim(),
        product_type: type,
        category_id:  categoryId,
        unit_id:      unitId,
        is_active:    true,
        cost_source:  'purchase',
      },
      {
        onSuccess: (product) => {
          toast.success(t($ => $.createMaterial.createdSuccess, { name: product.name }));
          onCreated(product as unknown as Product);
          handleClose(false);
        },
        onError: (err) => setError(extractMessage(err)),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t($ => $.createMaterial.title)}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Type */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t($ => $.createMaterial.typeLabel)}</Label>
            <div className="flex gap-2">
              {(['raw_material', 'packaging_material'] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setType(tp)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    type === tp
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {tp === 'raw_material' ? t($ => $.materialTypes.rawMaterial) : t($ => $.materialTypes.packaging)}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t($ => $.createMaterial.nameLabel)}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t($ => $.createMaterial.namePlaceholder)}
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t($ => $.createMaterial.categoryLabel)}</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">{t($ => $.createMaterial.categoryPlaceholder)}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t($ => $.createMaterial.unitLabel)}</Label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">{t($ => $.createMaterial.unitPlaceholder)}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>{t($ => $.createMaterial.cancel)}</Button>
          <Button onClick={handleSave} disabled={createMaterial.isPending}>
            {createMaterial.isPending ? t($ => $.createMaterial.creating) : t($ => $.createMaterial.submit)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Material Picker Dialog ───────────────────────────────────────────────────

type MaterialPickerProps = {
  open:              boolean;
  onOpenChange:      (open: boolean) => void;
  materials:         Product[];
  isLoading:         boolean;
  alreadySelected:   string[];
  onSelect:          (material: Product) => void;
  onMaterialCreated: (product: Product) => void;
};

function MaterialPicker({
  open, onOpenChange, materials, isLoading, alreadySelected, onSelect, onMaterialCreated,
}: MaterialPickerProps) {
  const { t } = useTranslation('recipes');
  const [search,      setSearch]      = useState('');
  const [createOpen,  setCreateOpen]  = useState(false);
  const [createType,  setCreateType]  = useState<'raw_material' | 'packaging_material'>('raw_material');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return materials.filter(
      (m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q),
    );
  }, [materials, search]);

  const rawMaterials  = filtered.filter((m) => m.product_type === 'raw_material');
  const pkgMaterials  = filtered.filter((m) => m.product_type === 'packaging_material');

  function handleCreated(product: Product) {
    onMaterialCreated(product);
    onSelect(product);
    onOpenChange(false);
  }

  function handleOpenCreate(type: 'raw_material' | 'packaging_material') {
    setCreateType(type);
    setCreateOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSearch(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t($ => $.materialPicker.title)}</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              className="pl-8"
              placeholder={t($ => $.materialPicker.searchPlaceholder)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y">
            {isLoading ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{t($ => $.materialPicker.loading)}</p>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground text-sm mb-3">{t($ => $.materialPicker.noMaterials)}</p>
                <div className="flex gap-2 justify-center">
                  <Button type="button" size="sm" variant="outline" onClick={() => handleOpenCreate('raw_material')}>
                    <Plus className="size-3.5 mr-1" /> {t($ => $.materialTypes.rawMaterial)}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleOpenCreate('packaging_material')}>
                    <Plus className="size-3.5 mr-1" /> {t($ => $.materialTypes.packaging)}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Raw Materials group */}
                {rawMaterials.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-muted/40 flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
                        {t($ => $.materialsGroup.rawMaterials)}
                      </span>
                      <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-xs" onClick={() => handleOpenCreate('raw_material')}>
                        <Plus className="size-3" /> {t($ => $.actions.newButton)}
                      </Button>
                    </div>
                    {rawMaterials.map((m) => <MaterialRow key={m.id} m={m} alreadySelected={alreadySelected} onSelect={onSelect} onClose={() => { onOpenChange(false); setSearch(''); }} />)}
                  </>
                )}

                {/* Packaging Materials group */}
                {pkgMaterials.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-muted/40 flex items-center justify-between">
                      <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">
                        {t($ => $.materialsGroup.packagingMaterials)}
                      </span>
                      <Button type="button" size="sm" variant="ghost" className="h-5 px-1.5 text-xs" onClick={() => handleOpenCreate('packaging_material')}>
                        <Plus className="size-3" /> {t($ => $.actions.newButton)}
                      </Button>
                    </div>
                    {pkgMaterials.map((m) => <MaterialRow key={m.id} m={m} alreadySelected={alreadySelected} onSelect={onSelect} onClose={() => { onOpenChange(false); setSearch(''); }} />)}
                  </>
                )}
              </>
            )}
          </div>

          {/* Bottom create buttons when results exist */}
          {!isLoading && filtered.length > 0 && (
            <div className="border-t pt-3 flex gap-2">
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => handleOpenCreate('raw_material')}>
                <Plus className="size-3.5 mr-1" /> {t($ => $.materialPicker.createRawMaterial)}
              </Button>
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => handleOpenCreate('packaging_material')}>
                <Plus className="size-3.5 mr-1" /> {t($ => $.materialPicker.createPackaging)}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <QuickMaterialDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultType={createType}
        onCreated={handleCreated}
      />
    </>
  );
}

function MaterialRow({
  m, alreadySelected, onSelect, onClose,
}: { m: Product; alreadySelected: string[]; onSelect: (m: Product) => void; onClose: () => void }) {
  const { t } = useTranslation('recipes');
  const { currency, locale } = useCompany();
  const added = alreadySelected.includes(m.id);
  return (
    <button
      type="button"
      onClick={() => { if (!added) { onSelect(m); onClose(); } }}
      disabled={added}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {getMediaUrl(m.image_url) ? (
        <img src={getMediaUrl(m.image_url)!} alt={m.name} className="size-8 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="size-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <Package className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{m.name}</p>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs font-mono">{m.sku}</p>
          {m.category?.name && (
            <span className="text-xs text-muted-foreground">· {m.category.name}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <MaterialTypeBadge type={m.product_type} />
        {m.material_cost != null && m.material_cost > 0 ? (
          <span className="text-xs font-medium tabular-nums">{fmtCost(m.material_cost, currency, locale)}</span>
        ) : (
          <span className="text-xs text-amber-500 flex items-center gap-0.5">
            <TriangleAlert className="size-3" />{t($ => $.noCost)}
          </span>
        )}
      </div>
      {added && <Badge variant="secondary" className="text-xs ml-1">{t($ => $.materialPicker.added)}</Badge>}
    </button>
  );
}


// ─── View Workspace ───────────────────────────────────────────────────────────

function ViewWorkspace({ recipe }: { recipe: Recipe }) {
  const { t } = useTranslation('recipes');
  const { currency, locale } = useCompany();
  const navigate = useNavigate();
  const [drawerMaterial, setDrawerMaterial] = useState<Product | null>(null);

  const { data: allMaterialsData } = useProductsQuery({
    product_types: 'raw_material,packaging_material',
    status: 'all',
    per_page: 999,
  } as Parameters<typeof useProductsQuery>[0]);

  const rmMap = useMemo(() => {
    const map = new Map<string, Product>();
    (allMaterialsData?.items ?? []).forEach((p) => map.set(p.id, p));
    return map;
  }, [allMaterialsData]);

  const lineCosts = recipe.lines.map((line) => {
    const product      = rmMap.get(line.raw_material_id);
    const unitCost     = product?.material_cost ?? null;
    const hasCost      = unitCost != null && unitCost > 0;
    const effectiveQty = line.quantity * (1 + (line.waste_percentage || 0) / 100);
    const lineTotal    = hasCost ? effectiveQty * (unitCost as number) : 0;
    return { ...line, product, unitCost, hasCost, effectiveQty, lineTotal };
  });

  const { rawMaterialCost, packagingCost, manufacturingCost, otherCosts, recipeCost } = calcRecipeCostFromFormLines(
    recipe.lines.map((l) => ({
      raw_material_id: l.raw_material_id,
      quantity: l.quantity,
      waste_percentage: l.waste_percentage,
    })),
    rmMap,
    recipe.manufacturing_cost ?? 0,
    recipe.other_costs ?? 0,
  );

  // Split lines into groups
  const rawLines = lineCosts.filter((l) => (l.raw_material?.product_type ?? l.product?.product_type) !== 'packaging_material');
  const pkgLines = lineCosts.filter((l) => (l.raw_material?.product_type ?? l.product?.product_type) === 'packaging_material');

  const rawSubtotal = rawLines.reduce((s, l) => s + l.lineTotal, 0);
  const pkgSubtotal = pkgLines.reduce((s, l) => s + l.lineTotal, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={recipe.product?.name ?? recipe.bom_number}
        breadcrumbs={[
          { label: t($ => $.page.breadcrumbs.home),    to: ROUTES.dashboard },
          { label: t($ => $.page.breadcrumbs.recipes), to: ROUTES.recipes },
          { label: recipe.product?.name ?? recipe.bom_number },
        ]}
        actions={
          <Button onClick={() => navigate(`${ROUTES.recipes}/${recipe.id}/edit`)}>
            <Pencil className="size-4" />
            {t($ => $.actions.edit)}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          {/* Details */}
          <WorkspaceCard title={t($ => $.workspace.details)}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <LabelValue label={t($ => $.workspace.recipeNumber)} value={<span className="font-mono text-xs">{recipe.bom_number}</span>} />
              <LabelValue label={t($ => $.workspace.product_label)} value={recipe.product?.name} />
              <LabelValue
                label={t($ => $.workspace.status)}
                value={
                  recipe.is_active
                    ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{t($ => $.status.active)}</Badge>
                    : <Badge variant="outline" className="text-xs text-muted-foreground">{t($ => $.status.draft)}</Badge>
                }
              />
            </div>
          </WorkspaceCard>

          {/* Materials — grouped */}
          <WorkspaceCard title={t($ => $.workspace.materials)}>
            {recipe.lines.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t($ => $.workspace.noMaterialsView)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-start">
                      <th className="pb-2 pe-3 font-medium">{t($ => $.tableColumns.material)}</th>
                      <th className="pb-2 pe-3 font-medium w-24">{t($ => $.tableColumns.type)}</th>
                      <th className="pb-2 pe-3 font-medium w-24">{t($ => $.tableColumns.category)}</th>
                      <th className="pb-2 pe-3 font-medium w-14">{t($ => $.tableColumns.unit)}</th>
                      <th className="pb-2 pe-3 text-end font-medium w-20">{t($ => $.tableColumns.reqQty)}</th>
                      <th className="pb-2 pe-3 text-end font-medium w-16">{t($ => $.tableColumns.wastePct)}</th>
                      <th className="pb-2 pe-3 text-end font-medium w-20">{t($ => $.tableColumns.effQty)}</th>
                      <th className="pb-2 pe-3 text-end font-medium w-28">{t($ => $.tableColumns.unitCost)}</th>
                      <th className="pb-2 text-end font-medium w-28">{t($ => $.tableColumns.totalCost)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {/* Raw Materials group */}
                    {rawLines.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={9} className="py-1.5 px-0">
                            <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
                              {t($ => $.materialsGroup.rawMaterials)}
                            </span>
                          </td>
                        </tr>
                        {rawLines.map((line) => (
                          <MaterialViewRow key={line.id} line={line} onOpenDrawer={(p) => setDrawerMaterial(p)} />
                        ))}
                        <tr className="bg-muted/30">
                          <td colSpan={8} className="py-1.5 pe-3 text-end text-xs font-medium text-muted-foreground">{t($ => $.materialsGroup.rawSubtotal)}</td>
                          <td className="py-1.5 text-end text-xs font-semibold tabular-nums">{fmtCost(rawSubtotal, currency, locale)}</td>
                        </tr>
                      </>
                    )}

                    {/* Packaging Materials group */}
                    {pkgLines.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={9} className="py-1.5 px-0">
                            <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">
                              {t($ => $.materialsGroup.packagingMaterials)}
                            </span>
                          </td>
                        </tr>
                        {pkgLines.map((line) => (
                          <MaterialViewRow key={line.id} line={line} onOpenDrawer={(p) => setDrawerMaterial(p)} />
                        ))}
                        <tr className="bg-muted/30">
                          <td colSpan={8} className="py-1.5 pe-3 text-end text-xs font-medium text-muted-foreground">{t($ => $.materialsGroup.packagingSubtotal)}</td>
                          <td className="py-1.5 text-end text-xs font-semibold tabular-nums">{fmtCost(pkgSubtotal, currency, locale)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </WorkspaceCard>

          {/* Recipe Notes */}
          {recipe.notes && (
            <WorkspaceCard title={t($ => $.workspace.recipeNotes)}>
              <p className="text-sm whitespace-pre-wrap">{recipe.notes}</p>
            </WorkspaceCard>
          )}

          {/* Execution Instructions */}
          {recipe.execution_instructions && (
            <WorkspaceCard title={t($ => $.workspace.executionInstructions)}>
              <p className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">{recipe.execution_instructions}</p>
            </WorkspaceCard>
          )}
        </div>

        {/* Cost Summary */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <WorkspaceCard title={t($ => $.costSummary.title)}>
            <div className="flex flex-col gap-3">
              <LabelValue label={t($ => $.costSummary.totalMaterials)} value={recipe.lines.length} />
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t($ => $.costSummary.rawMaterials)}</span>
                <span className="tabular-nums">{fmtCost(rawMaterialCost, currency, locale)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t($ => $.costSummary.packaging)}</span>
                <span className="tabular-nums">{fmtCost(packagingCost, currency, locale)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t($ => $.costSummary.manufacturing)}</span>
                <span className="tabular-nums">{fmtCost(manufacturingCost, currency, locale)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t($ => $.costSummary.otherCosts)}</span>
                <span className="tabular-nums">{fmtCost(otherCosts, currency, locale)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {t($ => $.costSummary.recipeCost)}
                  <LiveCostBadge />
                </span>
                <span className="text-sm font-bold tabular-nums">{fmtCost(recipeCost, currency, locale)}</span>
              </div>
            </div>
          </WorkspaceCard>
        </div>
      </div>

      <RawMaterialDetailDrawer
        material={drawerMaterial as RawMaterial | null}
        open={drawerMaterial !== null}
        onOpenChange={(open) => { if (!open) setDrawerMaterial(null); }}
      />
    </div>
  );
}

type LineCostRow = {
  id: string;
  raw_material_id: string;
  raw_material: Recipe['lines'][0]['raw_material'];
  product: Product | undefined;
  unitCost: number | null;
  hasCost: boolean;
  effectiveQty: number;
  lineTotal: number;
  quantity: number;
  waste_percentage: number;
};

function MaterialViewRow({ line, onOpenDrawer }: { line: LineCostRow; onOpenDrawer: (p: Product) => void }) {
  const { t } = useTranslation('recipes');
  const { currency, locale } = useCompany();
  const mat = line.product;
  return (
    <tr
      className="cursor-pointer hover:bg-muted/30"
      onClick={() => mat && onOpenDrawer(mat)}
    >
      <td className="py-2 pe-3">
        <div className="flex items-center gap-2">
          {getMediaUrl(mat?.image_url ?? line.raw_material?.image_url) ? (
            <img
              src={getMediaUrl(mat?.image_url ?? line.raw_material?.image_url)!}
              alt={mat?.name ?? line.raw_material?.name}
              className="size-7 rounded object-cover shrink-0"
            />
          ) : (
            <div className="size-7 rounded bg-muted flex items-center justify-center shrink-0">
              <Package className="size-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{line.raw_material?.name ?? '—'}</span>
            <span className="text-muted-foreground text-xs font-mono">{line.raw_material?.sku}</span>
          </div>
        </div>
      </td>
      <td className="py-2 pe-3">
        {line.raw_material?.product_type && (
          <MaterialTypeBadge type={line.raw_material.product_type} />
        )}
      </td>
      <td className="py-2 pe-3 text-muted-foreground text-xs">
        {mat?.category?.name ?? '—'}
      </td>
      <td className="py-2 pe-3 text-muted-foreground text-xs">
        {line.raw_material?.unit?.symbol ?? '—'}
      </td>
      <td className="py-2 pe-3 text-end tabular-nums">{fmt(line.quantity, 4)}</td>
      <td className="py-2 pe-3 text-end tabular-nums text-muted-foreground text-xs">
        {fmt(line.waste_percentage || 0, 1)}%
      </td>
      <td className="py-2 pe-3 text-end tabular-nums font-medium text-xs">
        {fmt(line.effectiveQty, 4)}
      </td>
      <td className="py-2 pe-3 text-end">
        {line.hasCost ? (
          <span className="tabular-nums">{fmtCost(line.unitCost as number, currency, locale)}</span>
        ) : (
          <span className="text-amber-500 text-xs flex items-center justify-end gap-1">
            <TriangleAlert className="size-3" />{t($ => $.noCost)}
          </span>
        )}
      </td>
      <td className="py-2 text-end tabular-nums">
        {line.hasCost ? fmtCost(line.lineTotal, currency, locale) : '—'}
      </td>
    </tr>
  );
}

// ─── Form Workspace ───────────────────────────────────────────────────────────

type LineError = {
  raw_material_id?: { message?: string };
  quantity?:        { message?: string };
  waste_percentage?: { message?: string };
};

// Duplicate protection dialog
function DuplicateDialog({
  open, productName, onReplace, onCancel,
}: { open: boolean; productName: string; onReplace: () => void; onCancel: () => void }) {
  const { t } = useTranslation('recipes');
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t($ => $.duplicateDialog.title)}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t($ => $.duplicateDialog.description, { name: productName })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{t($ => $.duplicateDialog.cancel)}</Button>
          <Button variant="destructive" onClick={onReplace}>{t($ => $.duplicateDialog.replace)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormWorkspace({ recipe, mode }: { recipe: Recipe | null; mode: 'create' | 'edit' }) {
  const { t } = useTranslation('recipes');
  const { currency, locale } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  // Part 5 — "Start From" — seeded from navigation state when Clone/Create-From was clicked
  const locationState = location.state as { sourceRecipeId?: string; product_id?: string } | null;
  const initialSourceId = mode === 'create' ? (locationState?.sourceRecipeId ?? '') : '';
  const prefilledProductId = mode === 'create' ? (locationState?.product_id ?? '') : '';
  const [startFrom,     setStartFrom]     = useState<'blank' | 'existing'>(initialSourceId ? 'existing' : 'blank');
  const [sourceRecipeId, setSourceRecipeId] = useState<string>(initialSourceId);
  const lastAppliedSourceIdRef = useRef<string>('');

  const [serverError,        setServerError]        = useState<string | null>(null);
  const [pickerOpen,         setPickerOpen]         = useState(false);
  const [drawerMaterial,     setDrawerMaterial]     = useState<Product | null>(null);
  const [dupDialogOpen,      setDupDialogOpen]      = useState(false);
  const [dupProductName,     setDupProductName]     = useState('');
  const [pendingProductId,   setPendingProductId]   = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe(recipe?.id ?? '');

  // Company → Channel → Product cascade state
  const [selectedCompanyId,  setSelectedCompanyId]  = useState<string>('');
  const [selectedChannelId,  setSelectedChannelId]  = useState<string>('');

  const { data: companyOptions, isLoading: loadingCompanies } = useCompanyOptions();

  const { data: channelData, isLoading: loadingChannels } = useQuery({
    queryKey: ['channels-by-company', selectedCompanyId],
    queryFn: () => channelsService.list({ company_id: selectedCompanyId, per_page: 200 }),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });
  const filteredChannelOptions = (channelData?.items ?? []).map((c) => ({ value: c.id, label: c.name }));

  // Finished goods — eligible only in create mode; filtered by company/channel when selected
  const { data: finishedGoods, isLoading: loadingFG } = useProductsQuery({
    product_type: 'finished_good',
    status: 'active',
    eligible_for_recipe: mode === 'create' ? true : undefined,
    company_id: selectedCompanyId || undefined,
    channel_id: selectedChannelId || undefined,
    per_page: 999,
  });

  // All materials (raw + packaging) for picker and live cost engine
  const { data: allMaterialsData, isLoading: loadingMaterials } = useProductsQuery({
    product_types: 'raw_material,packaging_material',
    status: 'all',
    per_page: 999,
  } as Parameters<typeof useProductsQuery>[0]);

  // All recipes for the "Existing Recipe" picker (create mode only)
  const { data: allRecipesData } = useRecipesQuery(
    mode === 'create' ? { per_page: 999, status: 'all' } : { search: '__skip__', per_page: 1 },
  );

  // Fetch full detail of the selected source recipe (includes lines)
  const { data: sourceRecipeDetail, isLoading: loadingSourceRecipe } = useRecipeQuery(
    startFrom === 'existing' && sourceRecipeId ? sourceRecipeId : '',
  );

  const fgOptions    = (finishedGoods?.items ?? []).map((p) => ({ value: p.id, label: p.name }));
  const recipeOptions = (allRecipesData?.items ?? []).map((r) => ({
    value: r.id,
    label: r.product?.name ? `${r.product.name} (${r.bom_number})` : r.bom_number,
  }));
  // Memoised so the empty-state fallback keeps a stable identity between renders.
  const allMaterials  = useMemo(() => allMaterialsData?.items ?? [], [allMaterialsData]);

  // Seed company/channel cascade from prefilled product (navigated from product page)
  const prefilledSeededRef = useRef(false);
  useEffect(() => {
    if (!prefilledProductId || prefilledSeededRef.current || !finishedGoods?.items?.length) return;
    const product = finishedGoods.items.find((p) => p.id === prefilledProductId);
    if (!product) return;
    prefilledSeededRef.current = true;
    const firstChannel = product.channels?.[0];
    if (firstChannel?.company_id) setSelectedCompanyId(firstChannel.company_id);
    if (firstChannel?.id)         setSelectedChannelId(firstChannel.id);
  }, [prefilledProductId, finishedGoods]);

  const rmMap = useMemo(() => {
    const map = new Map<string, Product>();
    allMaterials.forEach((p) => map.set(p.id, p));
    return map;
  }, [allMaterials]);

  // Form initialization — useForm only reads defaultValues on first render.
  // RecipeWorkspacePage guards with isLoading so recipe is available on first mount in edit mode.
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: recipe && mode === 'edit'
      ? {
          product_id:             recipe.product_id,
          notes:                  recipe.notes ?? '',
          execution_instructions: recipe.execution_instructions ?? '',
          manufacturing_cost:     recipe.manufacturing_cost ?? 0,
          other_costs:            recipe.other_costs ?? 0,
          yield_quantity:         recipe.yield_quantity ?? 1,
          lines: (recipe.lines ?? []).map((l) => ({
            raw_material_id:  l.raw_material_id,
            quantity:         l.quantity,
            waste_percentage: l.waste_percentage ?? 0,
          })),
        }
      : { product_id: prefilledProductId, notes: '', execution_instructions: '', manufacturing_cost: 0, other_costs: 0, yield_quantity: 1, lines: [] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const lineErrors = form.formState.errors.lines as LineError[] | undefined;

  // Part 2/3 — useWatch for instant live updates (no batching lag vs form.watch)
  const watchedLines      = useWatch({ control: form.control, name: 'lines' });
  const watchedProductId  = useWatch({ control: form.control, name: 'product_id' });
  const watchedMfgCostRaw = useWatch({ control: form.control, name: 'manufacturing_cost' });
  const watchedOtherRaw   = useWatch({ control: form.control, name: 'other_costs' });
  const watchedMfgCost    = watchedMfgCostRaw ?? 0;
  const watchedOtherCosts = watchedOtherRaw ?? 0;

  // Part 5 — when source recipe detail loads, copy fields into the form
  useEffect(() => {
    if (
      startFrom === 'existing' &&
      sourceRecipeId &&
      sourceRecipeDetail &&
      sourceRecipeId !== lastAppliedSourceIdRef.current
    ) {
      lastAppliedSourceIdRef.current = sourceRecipeId;
      form.reset({
        product_id:             '',
        notes:                  sourceRecipeDetail.notes ?? '',
        execution_instructions: sourceRecipeDetail.execution_instructions ?? '',
        manufacturing_cost:     sourceRecipeDetail.manufacturing_cost ?? 0,
        other_costs:            sourceRecipeDetail.other_costs ?? 0,
        yield_quantity:         sourceRecipeDetail.yield_quantity ?? 1,
        lines: sourceRecipeDetail.lines.map((l) => ({
          raw_material_id:  l.raw_material_id,
          quantity:         l.quantity,
          waste_percentage: l.waste_percentage ?? 0,
        })),
      });
    }
  }, [startFrom, sourceRecipeId, sourceRecipeDetail, form]);

  // Reset form when background refetch brings fresher server data (stale-while-revalidate pattern).
  // Deps: recipe?.updated_at so this only fires when the server record actually changes.
  useEffect(() => {
    if (mode === 'edit' && recipe) {
      form.reset({
        product_id:             recipe.product_id,
        notes:                  recipe.notes ?? '',
        execution_instructions: recipe.execution_instructions ?? '',
        manufacturing_cost:     recipe.manufacturing_cost ?? 0,
        other_costs:            recipe.other_costs ?? 0,
        yield_quantity:         recipe.yield_quantity ?? 1,
        lines: (recipe.lines ?? []).map((l) => ({
          raw_material_id:  l.raw_material_id,
          quantity:         l.quantity,
          waste_percentage: l.waste_percentage ?? 0,
        })),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.updated_at, mode]);

  // Live cost computation
  const lineCosts = useMemo(
    () =>
      watchedLines.map((line) => {
        const product      = rmMap.get(line.raw_material_id);
        const unitCost     = product?.material_cost ?? null;
        const hasCost      = unitCost != null && unitCost > 0;
        const qty          = line.quantity || 0;
        const waste        = line.waste_percentage ?? 0;
        const effectiveQty = qty * (1 + waste / 100);
        const lineTotal    = hasCost ? effectiveQty * (unitCost as number) : 0;
        return { unitCost, hasCost, effectiveQty, lineTotal };
      }),
    [watchedLines, rmMap],
  );

  const { rawMaterialCost, packagingCost, recipeCost } = useMemo(
    () => calcRecipeCostFromFormLines(
      watchedLines.map((l) => ({
        raw_material_id: l.raw_material_id,
        quantity: l.quantity,
        waste_percentage: l.waste_percentage,
      })),
      rmMap,
      watchedMfgCost,
      watchedOtherCosts,
    ),
    [watchedLines, rmMap, watchedMfgCost, watchedOtherCosts],
  );

  const anyMissingCost = fields.length > 0 && watchedLines.some((l, i) => {
    if (!l.raw_material_id) return false;
    const p = rmMap.get(l.raw_material_id);
    if (!p) return false;
    return !lineCosts[i]?.hasCost;
  });

  const selectedMaterialIds = watchedLines.map((l) => l.raw_material_id).filter(Boolean);

  // Split lines into groups for display
  const linesByIndex = fields.map((f, i) => ({ field: f, index: i }));
  const rawLineIdxs = linesByIndex.filter(({ index }) => {
    const id = watchedLines[index]?.raw_material_id;
    const p  = id ? rmMap.get(id) : undefined;
    return !p || p.product_type !== 'packaging_material';
  });
  const pkgLineIdxs = linesByIndex.filter(({ index }) => {
    const id = watchedLines[index]?.raw_material_id;
    const p  = id ? rmMap.get(id) : undefined;
    return !!p && p.product_type === 'packaging_material';
  });

  const rawSubtotal = rawLineIdxs.reduce((s, { index }) => s + (lineCosts[index]?.lineTotal ?? 0), 0);
  const pkgSubtotal = pkgLineIdxs.reduce((s, { index }) => s + (lineCosts[index]?.lineTotal ?? 0), 0);

  function handleAddMaterial(material: Product) {
    append({ raw_material_id: material.id, quantity: 1, waste_percentage: 0 });
  }

  function handleMaterialCreated(product: Product) {
    void product; // invalidation handled by react-query
  }

  // Part 5 — toggle "Start From" radio
  function handleStartFromChange(value: 'blank' | 'existing') {
    setStartFrom(value);
    if (value === 'blank') {
      setSourceRecipeId('');
      lastAppliedSourceIdRef.current = '';
      form.reset({ product_id: '', notes: '', execution_instructions: '', manufacturing_cost: 0, other_costs: 0, yield_quantity: 1, lines: [] });
    }
  }

  // Part 6 — fresh backend validation on every product selection (no cached result)
  async function handleProductChange(newId: string | null) {
    const id = newId ?? '';
    if (mode === 'create' && id) {
      setIsCheckingDuplicate(true);
      try {
        const result = await recipesService.list({ product_id: id, per_page: 1 });
        if ((result.items?.length ?? 0) > 0) {
          const name = finishedGoods?.items.find((p) => p.id === id)?.name ?? id;
          setPendingProductId(id);
          setDupProductName(name);
          setDupDialogOpen(true);
          return;
        }
      } catch {
        // validation error — proceed anyway
      } finally {
        setIsCheckingDuplicate(false);
      }
    }
    form.setValue('product_id', id);
  }

  const handleSubmit: SubmitHandler<RecipeFormValues> = (values) => {
    setServerError(null);
    const payload = {
      product_id:              values.product_id,
      version:                 recipe?.version ?? '1.0',
      is_active:               recipe?.is_active ?? true,
      notes:                   values.notes || null,
      yield_quantity:          values.yield_quantity ?? 1,
      manufacturing_cost:      values.manufacturing_cost ?? 0,
      other_costs:             values.other_costs ?? 0,
      execution_instructions:  values.execution_instructions || null,
      lines: values.lines.map((l) => ({
        raw_material_id:  l.raw_material_id,
        quantity:         l.quantity,
        waste_percentage: l.waste_percentage ?? 0,
      })),
    };

    if (mode === 'create') {
      createRecipe.mutate(payload, {
        onSuccess: (created) => navigate(`${ROUTES.recipes}/${created.id}`),
        onError: (error) => setServerError(extractMessage(error)),
      });
    } else {
      updateRecipe.mutate(payload, {
        onSuccess: () => navigate(`${ROUTES.recipes}/${recipe!.id}`),
        onError: (error) => setServerError(extractMessage(error)),
      });
    }
  };

  const isPending = createRecipe.isPending || updateRecipe.isPending;
  const title = mode === 'create'
    ? t($ => $.workspace.createTitle)
    : t($ => $.workspace.editTitle, { name: recipe?.product?.name ?? recipe?.bom_number ?? '' });

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: t($ => $.page.breadcrumbs.home),    to: ROUTES.dashboard },
          { label: t($ => $.page.breadcrumbs.recipes), to: ROUTES.recipes },
          { label: title },
        ]}
      />

      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t($ => $.workspace.error)}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <FormProvider {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            <div className="flex flex-col gap-6">
              {/* Product selection */}
              <WorkspaceCard title={t($ => $.workspace.product)}>
                {/* Company filter */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t($ => $.companyFilter.label)} <span className="font-normal">{t($ => $.companyFilter.hint)}</span>
                  </Label>
                  <Combobox
                    options={companyOptions ?? []}
                    value={selectedCompanyId || null}
                    onChange={(v) => {
                      setSelectedCompanyId(v ?? '');
                      setSelectedChannelId('');
                      form.setValue('product_id', '');
                    }}
                    placeholder={t($ => $.companyFilter.placeholder)}
                    loading={loadingCompanies}
                  />
                </div>

                {/* Channel filter */}
                <div className="mt-3 flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t($ => $.channelFilter.label)} <span className="font-normal">{t($ => $.channelFilter.hint)}</span>
                  </Label>
                  <Combobox
                    options={filteredChannelOptions}
                    value={selectedChannelId || null}
                    onChange={(v) => {
                      setSelectedChannelId(v ?? '');
                      form.setValue('product_id', '');
                    }}
                    placeholder={selectedCompanyId ? t($ => $.channelFilter.placeholder) : t($ => $.channelFilter.selectCompanyFirst)}
                    loading={loadingChannels}
                  />
                </div>

                <div className="mt-3">
                  <FormField name="product_id" label={t($ => $.workspace.product_label)} required>
                    <Controller
                      control={form.control}
                      name="product_id"
                      render={({ field }) => (
                        <Combobox
                          options={fgOptions}
                          value={field.value || null}
                          onChange={(v) => void handleProductChange(v)}
                          placeholder={t($ => $.productFilter.placeholder)}
                          loading={loadingFG || isCheckingDuplicate}
                        />
                      )}
                    />
                  </FormField>
                </div>

                {!watchedProductId && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <TriangleAlert className="size-4 flex-shrink-0" />
                    {t($ => $.workspace.selectProductWarning)}
                  </div>
                )}
              </WorkspaceCard>

              {/* Materials table */}
              <WorkspaceCard title={t($ => $.workspace.materials)}>
                <div className="flex flex-col gap-4">
                  {typeof form.formState.errors.lines?.message === 'string' && (
                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertDescription>{form.formState.errors.lines.message}</AlertDescription>
                    </Alert>
                  )}

                  {fields.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed py-10 text-center">
                      <PackageOpen className="size-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">{t($ => $.workspace.noMaterialsForm)}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t($ => $.workspace.noMaterialsHint)}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground border-b text-start">
                            <th className="pb-2 pe-3 font-medium">{t($ => $.tableColumns.material)}</th>
                            <th className="pb-2 pe-3 font-medium w-24">{t($ => $.tableColumns.type)}</th>
                            <th className="pb-2 pe-3 font-medium w-24">{t($ => $.tableColumns.category)}</th>
                            <th className="pb-2 pe-3 font-medium w-14">{t($ => $.tableColumns.unit)}</th>
                            <th className="pb-2 pe-3 font-medium w-24">{t($ => $.tableColumns.reqQty)}</th>
                            <th className="pb-2 pe-3 font-medium w-20">{t($ => $.tableColumns.wastePct)}</th>
                            <th className="pb-2 pe-3 text-end font-medium w-20">{t($ => $.tableColumns.effQty)}</th>
                            <th className="pb-2 pe-3 text-end font-medium w-28">{t($ => $.tableColumns.unitCost)}</th>
                            <th className="pb-2 pe-3 text-end font-medium w-28">{t($ => $.tableColumns.totalCost)}</th>
                            <th className="pb-2 w-16" />
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {/* Raw Materials group */}
                          {rawLineIdxs.length > 0 && (
                            <>
                              <tr>
                                <td colSpan={10} className="py-1.5 px-0">
                                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">
                                    {t($ => $.materialsGroup.rawMaterials)}
                                  </span>
                                </td>
                              </tr>
                              {rawLineIdxs.map(({ field, index }) => (
                                <MaterialFormRow
                                  key={field.id}
                                  index={index}
                                  form={form}
                                  rmMap={rmMap}
                                  lineCosts={lineCosts}
                                  lineErrors={lineErrors}
                                  watchedLines={watchedLines}
                                  onRemove={remove}
                                  onView={setDrawerMaterial}
                                />
                              ))}
                              <tr className="bg-muted/30">
                                <td colSpan={8} className="py-1 pe-3 text-end text-xs font-medium text-muted-foreground">{t($ => $.materialsGroup.rawSubtotal)}</td>
                                <td className="py-1 pe-3 text-end text-xs font-semibold tabular-nums">{fmtCost(rawSubtotal, currency, locale)}</td>
                                <td />
                              </tr>
                            </>
                          )}

                          {/* Packaging Materials group */}
                          {pkgLineIdxs.length > 0 && (
                            <>
                              <tr>
                                <td colSpan={10} className="py-1.5 px-0">
                                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">
                                    {t($ => $.materialsGroup.packagingMaterials)}
                                  </span>
                                </td>
                              </tr>
                              {pkgLineIdxs.map(({ field, index }) => (
                                <MaterialFormRow
                                  key={field.id}
                                  index={index}
                                  form={form}
                                  rmMap={rmMap}
                                  lineCosts={lineCosts}
                                  lineErrors={lineErrors}
                                  watchedLines={watchedLines}
                                  onRemove={remove}
                                  onView={setDrawerMaterial}
                                />
                              ))}
                              <tr className="bg-muted/30">
                                <td colSpan={8} className="py-1 pe-3 text-end text-xs font-medium text-muted-foreground">{t($ => $.materialsGroup.packagingSubtotal)}</td>
                                <td className="py-1 pe-3 text-end text-xs font-semibold tabular-nums">{fmtCost(pkgSubtotal, currency, locale)}</td>
                                <td />
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                    disabled={!watchedProductId}
                  >
                    <Plus className="size-4" />
                    {t($ => $.actions.addMaterial)}
                  </Button>
                </div>
              </WorkspaceCard>

              {/* Recipe Notes */}
              <WorkspaceCard title={t($ => $.workspace.recipeNotes)}>
                <FormField name="notes" label="">
                  <Textarea
                    placeholder={t($ => $.workspace.notesPlaceholder)}
                    rows={3}
                    {...form.register('notes')}
                  />
                </FormField>
              </WorkspaceCard>

              {/* Execution Instructions */}
              <WorkspaceCard title={t($ => $.workspace.executionInstructions)}>
                <FormField name="execution_instructions" label="">
                  <Textarea
                    placeholder={t($ => $.workspace.executionPlaceholder)}
                    rows={5}
                    className="font-mono text-sm"
                    {...form.register('execution_instructions')}
                  />
                </FormField>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t($ => $.workspace.executionHint)}
                </p>
              </WorkspaceCard>
            </div>

            {/* Context Sidebar — workflow + live summary */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">

              {/* Start From — create mode only */}
              {mode === 'create' && (
                <WorkspaceCard title={t($ => $.startFrom.title)}>
                  <div className="flex flex-col gap-3">
                    {/* Radio buttons */}
                    <div className="flex flex-col gap-2">
                      {(['blank', 'existing'] as const).map((opt) => (
                        <label key={opt} className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="start-from"
                            value={opt}
                            checked={startFrom === opt}
                            onChange={() => handleStartFromChange(opt)}
                            className="accent-primary size-3.5"
                          />
                          <span className="text-sm font-medium">
                            {opt === 'blank' ? t($ => $.startFrom.blank) : t($ => $.startFrom.existing)}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Existing recipe selector — only when "existing" */}
                    {startFrom === 'existing' && (
                      <>
                        <Separator />
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs text-muted-foreground">{t($ => $.startFrom.selectExisting)}</Label>
                          <Combobox
                            options={recipeOptions}
                            value={sourceRecipeId || null}
                            onChange={(v) => setSourceRecipeId(v ?? '')}
                            placeholder={t($ => $.startFrom.searchPlaceholder)}
                            loading={false}
                          />
                          {loadingSourceRecipe && (
                            <p className="text-xs text-muted-foreground">{t($ => $.startFrom.loadingRecipe)}</p>
                          )}
                          {sourceRecipeId && sourceRecipeDetail && !loadingSourceRecipe && (
                            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              <Copy className="size-3.5 shrink-0 mt-0.5" />
                              <span>
                                {t($ => $.startFrom.copiedCount, { count: sourceRecipeDetail.lines?.length ?? 0 })}
                                {(sourceRecipeDetail.manufacturing_cost ?? 0) > 0 && t($ => $.startFrom.manufacturingAppend, { cost: fmtCost(sourceRecipeDetail.manufacturing_cost ?? 0, currency, locale) })}
                                {' '}{t($ => $.startFrom.fromLabel)} <strong>{sourceRecipeDetail.product?.name ?? sourceRecipeDetail.bom_number}</strong>{t($ => $.startFrom.period)}
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </WorkspaceCard>
              )}

              {/* Cost Summary */}
              <WorkspaceCard title={t($ => $.costSummary.title)}>
                <div className="flex flex-col gap-3">
                  {recipe && (
                    <LabelValue
                      label={t($ => $.costSummary.recipeNumber)}
                      value={<span className="font-mono text-xs">{recipe.bom_number}</span>}
                    />
                  )}
                  <LabelValue label={t($ => $.costSummary.totalMaterials)} value={fields.length} />
                  <Separator />

                  {/* Raw / Packaging live rows */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t($ => $.costSummary.rawMaterials)}</span>
                    <span className="tabular-nums">{fmtCost(rawMaterialCost, currency, locale)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t($ => $.costSummary.packaging)}</span>
                    <span className="tabular-nums">{fmtCost(packagingCost, currency, locale)}</span>
                  </div>

                  <Separator />

                  {/* Yield Quantity — units produced per recipe run (drives per-unit costing) */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">{t($ => $.costSummary.yieldQuantity)}</Label>
                    <Input
                      type="number"
                      min="0.0001"
                      step="0.01"
                      className="h-8 text-sm"
                      placeholder="1"
                      {...form.register('yield_quantity', { valueAsNumber: true })}
                    />
                    {form.formState.errors.yield_quantity && (
                      <p className="text-xs text-destructive">{form.formState.errors.yield_quantity.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{t($ => $.costSummary.yieldHint)}</p>
                  </div>

                  {/* Manufacturing Cost — editable */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">{t($ => $.costSummary.manufacturingCost)}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 text-sm"
                      placeholder="0.00"
                      {...form.register('manufacturing_cost', { valueAsNumber: true })}
                    />
                    {form.formState.errors.manufacturing_cost && (
                      <p className="text-xs text-destructive">{form.formState.errors.manufacturing_cost.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{t($ => $.costSummary.manufacturingHint)}</p>
                  </div>

                  {/* Other Costs — editable */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">{t($ => $.costSummary.otherCosts)}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 text-sm"
                      placeholder="0.00"
                      {...form.register('other_costs', { valueAsNumber: true })}
                    />
                    {form.formState.errors.other_costs && (
                      <p className="text-xs text-destructive">{form.formState.errors.other_costs.message}</p>
                    )}
                  </div>

                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {t($ => $.costSummary.recipeCost)}
                      <LiveCostBadge />
                    </span>
                    <span className="text-sm font-bold tabular-nums">{fmtCost(recipeCost, currency, locale)}</span>
                  </div>

                  {anyMissingCost && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <TriangleAlert className="size-3.5 flex-shrink-0 mt-0.5" />
                      <span>{t($ => $.costSummary.missingCost)}</span>
                    </div>
                  )}
                </div>
              </WorkspaceCard>
            </div>
          </div>
        </form>
      </FormProvider>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur px-6 py-3">
        <div className="flex items-center justify-end gap-3 max-w-screen-xl mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(recipe ? `${ROUTES.recipes}/${recipe.id}` : ROUTES.recipes)}
          >
            {t($ => $.footer.cancel)}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending
              ? (mode === 'create' ? t($ => $.footer.creating) : t($ => $.footer.saving))
              : (mode === 'create' ? t($ => $.footer.create) : t($ => $.footer.save))}
          </Button>
        </div>
      </div>

      <MaterialPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        materials={allMaterials}
        isLoading={loadingMaterials}
        alreadySelected={selectedMaterialIds}
        onSelect={handleAddMaterial}
        onMaterialCreated={handleMaterialCreated}
      />

      <RawMaterialDetailDrawer
        material={drawerMaterial as RawMaterial | null}
        open={drawerMaterial !== null}
        onOpenChange={(open) => { if (!open) setDrawerMaterial(null); }}
      />

      <DuplicateDialog
        open={dupDialogOpen}
        productName={dupProductName}
        onReplace={() => {
          if (pendingProductId) form.setValue('product_id', pendingProductId);
          setDupDialogOpen(false);
          setPendingProductId(null);
        }}
        onCancel={() => {
          setDupDialogOpen(false);
          setPendingProductId(null);
        }}
      />
    </div>
  );
}

// ─── Material Form Row (extracted for reuse in groups) ────────────────────────

type FormInstance = UseFormReturn<RecipeFormValues>;

function MaterialFormRow({
  index, form, rmMap, lineCosts, lineErrors, watchedLines, onRemove, onView,
}: {
  index:       number;
  form:        FormInstance;
  rmMap:       Map<string, Product>;
  lineCosts:   Array<{ unitCost: number | null; hasCost: boolean; effectiveQty: number; lineTotal: number }>;
  lineErrors:  LineError[] | undefined;
  watchedLines: RecipeFormValues['lines'];
  onRemove:    (index: number) => void;
  onView:      (p: Product) => void;
}) {
  const { t } = useTranslation('recipes');
  const { currency, locale } = useCompany();
  const errs    = lineErrors?.[index];
  const line    = watchedLines[index];
  const product = rmMap.get(line?.raw_material_id ?? '');
  const { unitCost, hasCost, effectiveQty, lineTotal } =
    lineCosts[index] ?? { unitCost: 0, hasCost: false, effectiveQty: 0, lineTotal: 0 };

  return (
    <tr>
      {/* Material */}
      <td className="py-2 pe-3">
        <div className="flex items-center gap-2">
          {getMediaUrl(product?.image_url) ? (
            <img src={getMediaUrl(product!.image_url)!} alt={product!.name} className="size-7 rounded object-cover flex-shrink-0" />
          ) : (
            <div className="size-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="size-3.5 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="truncate font-medium">
              {product?.name ?? line?.raw_material_id ?? '—'}
            </span>
            <span className="text-muted-foreground text-xs font-mono">
              {product?.sku}
            </span>
          </div>
        </div>
        {errs?.raw_material_id?.message && (
          <p className="text-destructive mt-1 text-xs">{errs.raw_material_id.message}</p>
        )}
      </td>

      {/* Type */}
      <td className="py-2 pe-3">
        {product && <MaterialTypeBadge type={product.product_type} />}
      </td>

      {/* Category */}
      <td className="py-2 pe-3 text-xs text-muted-foreground">
        {product?.category?.name ?? '—'}
      </td>

      {/* Unit */}
      <td className="py-2 pe-3 text-muted-foreground text-xs">
        {product?.unit?.symbol ?? '—'}
      </td>

      {/* Qty Required */}
      <td className="py-2 pe-3">
        <Input
          type="number"
          min="0.0001"
          step="0.0001"
          className="h-8 w-24"
          {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
        />
        {errs?.quantity?.message && (
          <p className="text-destructive mt-1 text-xs">{errs.quantity.message}</p>
        )}
      </td>

      {/* Waste % */}
      <td className="py-2 pe-3">
        <Input
          type="number"
          min="0"
          max="99.99"
          step="0.01"
          className="h-8 w-20"
          {...form.register(`lines.${index}.waste_percentage`, { valueAsNumber: true })}
        />
        {errs?.waste_percentage?.message && (
          <p className="text-destructive mt-1 text-xs">{errs.waste_percentage.message}</p>
        )}
      </td>

      {/* Effective Qty — read only */}
      <td className="py-2 pe-3 text-end tabular-nums text-xs font-medium">
        {fmt(effectiveQty, 4)}
      </td>

      {/* Current Cost */}
      <td className="py-2 pe-3 text-end tabular-nums">
        {hasCost ? (
          fmtCost(unitCost as number, currency, locale)
        ) : (
          <span className="text-amber-500 text-xs flex items-center justify-end gap-1">
            <TriangleAlert className="size-3" />{t($ => $.noCost)}
          </span>
        )}
      </td>

      {/* Total Cost */}
      <td className="py-2 pe-3 text-end font-medium tabular-nums">
        {hasCost ? fmtCost(lineTotal, currency, locale) : '—'}
      </td>

      {/* Actions */}
      <td className="py-2">
        <div className="flex items-center gap-1">
          {product && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => onView(product)}
              title={t($ => $.actions.viewMaterialDetails)}
            >
              <Eye className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive size-7"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page Shell ──────────────────────────────────────────────────────────────

export function RecipeWorkspacePage() {
  const { t } = useTranslation('recipes');
  const { id = '' } = useParams<{ id?: string }>();
  const { pathname } = useLocation();

  const mode = !id ? 'create' : pathname.endsWith('/edit') ? 'edit' : 'view';

  const { data: recipe, isLoading, isError } = useRecipeQuery(id);

  if (id && isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t($ => $.workspace.loading)}
      </div>
    );
  }

  if (id && (isError || (recipe === undefined && !isLoading))) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1">
        <p className="font-medium">{t($ => $.workspace.notFound)}</p>
        <p className="text-muted-foreground text-sm">
          {t($ => $.workspace.notFoundDesc)}
        </p>
      </div>
    );
  }

  if (mode === 'view' && recipe) {
    return <ViewWorkspace recipe={recipe} />;
  }

  return <FormWorkspace recipe={recipe ?? null} mode={mode as 'create' | 'edit'} />;
}
