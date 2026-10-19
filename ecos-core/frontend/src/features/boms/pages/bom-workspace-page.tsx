import { useState } from 'react';
import { Controller, FormProvider, useFieldArray, useForm } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Combobox, FormField, PageHeader } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useBomQuery, useCreateBom, useUpdateBom } from '@/features/boms/hooks/use-boms';
import { bomFormSchema, type BomFormValues } from '@/features/boms/schemas/bom-form-schema';
import type { Bom } from '@/features/boms/types/bom';
import { useProductsQuery } from '@/features/products/hooks/use-products';
import { ROUTES } from '@/router/routes';

const FORM_ID = 'bom-form';

function extractMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : fallback;
}

function LabelValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
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

function ViewWorkspace({ bom }: { bom: Bom }) {
  const { t } = useTranslation('boms');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={bom.bom_number}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.boms },
          { label: bom.bom_number },
        ]}
        actions={
          <Button onClick={() => navigate(`${ROUTES.boms}/${bom.id}/edit`)}>
            <Pencil className="size-4" />
            {t($ => $.workspace.edit)}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <WorkspaceCard title={t($ => $.workspace.details)}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <LabelValue label={t($ => $.workspace.bomNumber)} value={bom.bom_number} />
              <LabelValue label={t($ => $.workspace.finishedGood)} value={bom.product?.name} />
              <LabelValue label={t($ => $.workspace.version)} value={bom.version} />
              <LabelValue
                label={t($ => $.columns.status)}
                value={
                  bom.is_active ? (
                    <Badge variant="default">{t($ => $.status.active)}</Badge>
                  ) : (
                    <Badge variant="secondary">{t($ => $.status.inactive)}</Badge>
                  )
                }
              />
              {bom.notes ? (
                <div className="col-span-full">
                  <LabelValue label={t($ => $.workspace.notes)} value={bom.notes} />
                </div>
              ) : null}
            </div>
          </WorkspaceCard>

          <WorkspaceCard title={t($ => $.workspace.materials)}>
            {bom.lines.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t($ => $.workspace.noLines)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-start font-medium">{t($ => $.workspace.material)}</th>
                      <th className="pb-2 text-end font-medium">{t($ => $.workspace.quantity)}</th>
                      <th className="pb-2 text-end font-medium">{t($ => $.workspace.wastePercentage)}</th>
                      <th className="pb-2 text-end font-medium">{t($ => $.workspace.unit)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bom.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{line.raw_material?.name ?? '—'}</span>
                            <span className="text-muted-foreground text-xs">{line.raw_material?.sku}</span>
                          </div>
                        </td>
                        <td className="py-2 text-end">{line.quantity}</td>
                        <td className="py-2 text-end">{line.waste_percentage}%</td>
                        <td className="py-2 text-end">{line.raw_material?.unit?.symbol ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </WorkspaceCard>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <WorkspaceCard title={t($ => $.workspace.summary)}>
            <div className="flex flex-col gap-3">
              <LabelValue label={t($ => $.workspace.bomNumber)} value={<span className="font-mono">{bom.bom_number}</span>} />
              <LabelValue label={t($ => $.workspace.finishedGood)} value={bom.product?.name} />
              <LabelValue label={t($ => $.workspace.version)} value={bom.version} />
              <LabelValue
                label={t($ => $.columns.status)}
                value={
                  bom.is_active ? (
                    <Badge variant="default">{t($ => $.status.active)}</Badge>
                  ) : (
                    <Badge variant="secondary">{t($ => $.status.inactive)}</Badge>
                  )
                }
              />
              <div className="border-t pt-3">
                <LabelValue label={t($ => $.workspace.totalMaterials)} value={bom.lines.length} />
              </div>
            </div>
          </WorkspaceCard>
        </div>
      </div>
    </div>
  );
}

type LineError = {
  raw_material_id?: { message?: string };
  quantity?: { message?: string };
  waste_percentage?: { message?: string };
};

function FormWorkspace({ bom, mode }: { bom: Bom | null; mode: 'create' | 'edit' }) {
  const { t } = useTranslation('boms');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const createBom = useCreateBom();
  const updateBom = useUpdateBom(bom?.id ?? '');

  const { data: finishedGoods, isLoading: loadingFG } = useProductsQuery({
    product_type: 'finished_good',
    status: 'all',
    per_page: 999,
  });

  const { data: rawMaterialsData, isLoading: loadingRM } = useProductsQuery({
    product_type: 'raw_material',
    status: 'all',
    per_page: 999,
  });

  const fgOptions = (finishedGoods?.items ?? []).map((p) => ({ value: p.id, label: p.name }));
  const rmOptions = (rawMaterialsData?.items ?? []).map((p) => ({ value: p.id, label: p.name }));

  const form = useForm<BomFormValues>({
    resolver: zodResolver(bomFormSchema),
    defaultValues: bom
      ? {
          product_id: bom.product_id,
          version: bom.version,
          is_active: bom.is_active,
          notes: bom.notes ?? '',
          lines: bom.lines.map((l) => ({
            raw_material_id: l.raw_material_id,
            quantity: l.quantity,
            waste_percentage: l.waste_percentage,
          })),
        }
      : {
          product_id: '',
          version: '1.0',
          is_active: false,
          notes: '',
          lines: [{ raw_material_id: '', quantity: 1, waste_percentage: 0 }],
        },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const lineErrors = form.formState.errors.lines as LineError[] | undefined;

  const handleSubmit = (values: BomFormValues) => {
    setServerError(null);
    const payload = {
      product_id: values.product_id,
      version: values.version,
      is_active: values.is_active,
      notes: values.notes || null,
      lines: values.lines.map((l) => ({
        raw_material_id: l.raw_material_id,
        quantity: l.quantity,
        waste_percentage: l.waste_percentage ?? 0,
      })),
    };

    if (mode === 'create') {
      createBom.mutate(payload, {
        onSuccess: (created) => navigate(`${ROUTES.boms}/${created.id}`),
        onError: (error) => setServerError(extractMessage(error, t($ => $.workspace.unknownError))),
      });
    } else {
      updateBom.mutate(payload, {
        onSuccess: () => navigate(`${ROUTES.boms}/${bom!.id}`),
        onError: (error) => setServerError(extractMessage(error, t($ => $.workspace.unknownError))),
      });
    }
  };

  const isPending = createBom.isPending || updateBom.isPending;
  const title = mode === 'create' ? t($ => $.workspace.newTitle) : t($ => $.workspace.editTitle);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.boms },
          { label: title },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate(bom ? `${ROUTES.boms}/${bom.id}` : ROUTES.boms)}
            >
              {t($ => $.workspace.cancel)}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={isPending}>
              {isPending
                ? mode === 'create'
                  ? t($ => $.workspace.creating)
                  : t($ => $.workspace.saving)
                : mode === 'create'
                  ? t($ => $.workspace.create)
                  : t($ => $.workspace.save)}
            </Button>
          </>
        }
      />

      {serverError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t($ => $.workspace.errorTitle)}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <FormProvider {...form}>
        <form id={FORM_ID} onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-6">
              <WorkspaceCard title={t($ => $.workspace.details)}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <FormField name="product_id" label={t($ => $.workspace.finishedGood)} required>
                      <Controller
                        control={form.control}
                        name="product_id"
                        render={({ field }) => (
                          <Combobox
                            options={fgOptions}
                            value={field.value || null}
                            onChange={field.onChange}
                            placeholder={t($ => $.workspace.selectProduct)}
                            loading={loadingFG}
                          />
                        )}
                      />
                    </FormField>
                  </div>

                  <FormField name="version" label={t($ => $.workspace.version)} required>
                    <Input
                      placeholder={t($ => $.workspace.versionPlaceholder)}
                      {...form.register('version')}
                    />
                  </FormField>

                  <FormField name="is_active" label={t($ => $.workspace.isActive)}>
                    <div className="flex items-start gap-2 pt-1">
                      <Controller
                        control={form.control}
                        name="is_active"
                        render={({ field }) => (
                          <input
                            type="checkbox"
                            id="is_active"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300"
                          />
                        )}
                      />
                      <label htmlFor="is_active" className="text-muted-foreground cursor-pointer text-xs">
                        {t($ => $.workspace.isActiveHint)}
                      </label>
                    </div>
                  </FormField>

                  <div className="sm:col-span-2">
                    <FormField name="notes" label={t($ => $.workspace.notes)}>
                      <Textarea
                        placeholder={t($ => $.workspace.notesPlaceholder)}
                        rows={3}
                        {...form.register('notes')}
                      />
                    </FormField>
                  </div>
                </div>
              </WorkspaceCard>

              <WorkspaceCard title={t($ => $.workspace.materials)}>
                <div className="flex flex-col gap-3">
                  {typeof form.formState.errors.lines?.message === 'string' && (
                    <p className="text-destructive text-xs">{form.formState.errors.lines.message}</p>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b text-start">
                          <th className="pb-2 pe-3 font-medium">{t($ => $.workspace.material)}</th>
                          <th className="w-28 pb-2 pe-3 font-medium">{t($ => $.workspace.quantity)}</th>
                          <th className="w-24 pb-2 pe-3 font-medium">{t($ => $.workspace.wastePercentage)}</th>
                          <th className="w-10 pb-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {fields.map((field, index) => {
                          const errs = lineErrors?.[index];
                          return (
                            <tr key={field.id}>
                              <td className="py-2 pe-3">
                                <Controller
                                  control={form.control}
                                  name={`lines.${index}.raw_material_id`}
                                  render={({ field: f }) => (
                                    <Combobox
                                      options={rmOptions}
                                      value={f.value || null}
                                      onChange={f.onChange}
                                      placeholder={t($ => $.workspace.selectMaterial)}
                                      loading={loadingRM}
                                    />
                                  )}
                                />
                                {errs?.raw_material_id?.message ? (
                                  <p className="text-destructive mt-1 text-xs">
                                    {errs.raw_material_id.message}
                                  </p>
                                ) : null}
                              </td>
                              <td className="py-2 pe-3">
                                <Input
                                  type="number"
                                  min="0.0001"
                                  step="0.0001"
                                  {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                                />
                                {errs?.quantity?.message ? (
                                  <p className="text-destructive mt-1 text-xs">
                                    {errs.quantity.message}
                                  </p>
                                ) : null}
                              </td>
                              <td className="py-2 pe-3">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  {...form.register(`lines.${index}.waste_percentage`, { valueAsNumber: true })}
                                />
                                {errs?.waste_percentage?.message ? (
                                  <p className="text-destructive mt-1 text-xs">
                                    {errs.waste_percentage.message}
                                  </p>
                                ) : null}
                              </td>
                              <td className="py-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive size-8"
                                  onClick={() => remove(index)}
                                  disabled={fields.length === 1}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ raw_material_id: '', quantity: 1, waste_percentage: 0 })}
                  >
                    <Plus className="size-4" />
                    {t($ => $.workspace.addLine)}
                  </Button>
                </div>
              </WorkspaceCard>
            </div>

            <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
              <WorkspaceCard title={t($ => $.workspace.summary)}>
                <div className="flex flex-col gap-3">
                  {bom ? (
                    <LabelValue
                      label={t($ => $.workspace.bomNumber)}
                      value={<span className="font-mono">{bom.bom_number}</span>}
                    />
                  ) : null}
                  <LabelValue label={t($ => $.workspace.totalMaterials)} value={fields.length} />
                </div>
              </WorkspaceCard>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

export function BomWorkspacePage() {
  const { t } = useTranslation('boms');
  const { id = '' } = useParams<{ id?: string }>();
  const { pathname } = useLocation();

  const mode = !id ? 'create' : pathname.endsWith('/edit') ? 'edit' : 'view';

  const { data: bom, isLoading, isError } = useBomQuery(id);

  if (id && isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t($ => $.workspace.loading)}
      </div>
    );
  }

  if (id && (isError || (bom === undefined && !isLoading))) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1">
        <p className="font-medium">{t($ => $.workspace.notFound)}</p>
        <p className="text-muted-foreground text-sm">{t($ => $.workspace.notFoundMessage)}</p>
      </div>
    );
  }

  if (mode === 'view' && bom) {
    return <ViewWorkspace bom={bom} />;
  }

  return <FormWorkspace bom={bom ?? null} mode={mode as 'create' | 'edit'} />;
}
