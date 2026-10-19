import { useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Camera, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import type {
  GoodsReceiptFormValues,
  GrLineFormValues,
} from '@/features/goods-receipts/components/goods-receipt-form-schema';

export type PoLineInfo = {
  id: string;
  productName: string;
  productSku: string;
  unitPrice?: number;
  orderedQty?: number;
};

type LineError = {
  gross_received_quantity?: { message?: string };
  net_received_quantity?: { message?: string };
  notes?: { message?: string };
};

function fieldErr(err: LineError | undefined, k: keyof LineError) {
  const e = err?.[k];
  return typeof e?.message === 'string' ? e.message : undefined;
}

function fmt(n: number) {
  if (n === 0) return '0';
  return n % 1 === 0 ? String(n) : n.toFixed(4).replace(/\.?0+$/, '');
}

function varianceClass(variance: number) {
  if (variance < 0) return 'text-amber-600 dark:text-amber-400';
  if (variance > 0) return 'text-green-600 dark:text-green-400';
  return 'text-muted-foreground';
}

type Props = {
  readOnly?: boolean;
  poLineInfos?: PoLineInfo[];
};

export function GoodsReceiptLinesEditor({ readOnly = false, poLineInfos = [] }: Props) {
  const { t } = useTranslation('goods-receipts');
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<GoodsReceiptFormValues>();

  const lines: GrLineFormValues[] = useWatch({ control, name: 'lines' }) ?? [];
  const lineErrors = errors.lines as LineError[] | undefined;

  if (lines.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t($ => $.lines.selectPoPrompt)}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-start">
            <th className="pb-2 pr-3 font-medium">{t($ => $.lines.columns.product)}</th>
            <th className="w-28 pb-2 pr-3 text-end font-medium">{t($ => $.lines.columns.orderedQty)}</th>
            <th className="w-32 pb-2 pr-3 font-medium">{t($ => $.lines.columns.grossQty)}</th>
            <th className="w-32 pb-2 pr-3 font-medium">{t($ => $.lines.columns.netQty)}</th>
            <th className="w-24 pb-2 pr-3 text-end font-medium">{t($ => $.lines.columns.varianceQty)}</th>
            <th className="w-36 pb-2 pr-3 font-medium">{t($ => $.lines.columns.weightPhoto)}</th>
            <th className="w-40 pb-2 font-medium">{t($ => $.lines.columns.notes)}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {lines.map((line, index) => {
            const gross    = Number(line.gross_received_quantity ?? 0);
            const net      = Number(line.net_received_quantity ?? 0);
            const ordered  = line.ordered_quantity;
            const variance = net - ordered;
            const errs     = lineErrors?.[index];
            const info     = poLineInfos.find((p) => p.id === line.purchase_order_line_id);

            return (
              <LineRow
                key={line.purchase_order_line_id}
                index={index}
                line={line}
                info={info}
                gross={gross}
                net={net}
                ordered={ordered}
                variance={variance}
                errs={errs}
                readOnly={readOnly}
                register={register}
                setValue={setValue}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Extracted row so each has its own file-input ref
function LineRow({
  index, line, info, gross, net, ordered, variance, errs, readOnly, register, setValue,
}: {
  index: number;
  line: GrLineFormValues;
  info: PoLineInfo | undefined;
  gross: number;
  net: number;
  ordered: number;
  variance: number;
  errs: LineError | undefined;
  readOnly: boolean;
  register: ReturnType<typeof useFormContext<GoodsReceiptFormValues>>['register'];
  setValue: ReturnType<typeof useFormContext<GoodsReceiptFormValues>>['setValue'];
}) {
  const { t } = useTranslation('goods-receipts');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const hasPhoto = line.weight_photo instanceof File || Boolean(line.weight_photo_path);

  return (
    <tr>
      {/* Hidden fields */}
      <input type="hidden" {...register(`lines.${index}.purchase_order_line_id`)} />
      <input type="hidden" {...register(`lines.${index}.product_id`)} />
      <input type="hidden" {...register(`lines.${index}.ordered_quantity`, { valueAsNumber: true })} />
      <input type="hidden" {...register(`lines.${index}.unit_price`, { valueAsNumber: true })} />

      {/* Product */}
      <td className="py-3 pr-3">
        <span className="font-medium">{info?.productName ?? '—'}</span>
        {info?.productSku && (
          <span className="text-muted-foreground ml-1.5 text-xs">{info.productSku}</span>
        )}
      </td>

      {/* Ordered qty */}
      <td className="py-3 pr-3 text-end tabular-nums">{fmt(ordered)}</td>

      {/* Gross received qty */}
      <td className="py-3 pr-3">
        {readOnly ? (
          <span className="tabular-nums">{fmt(gross)}</span>
        ) : (
          <>
            <Input
              type="number"
              min="0.0001"
              step="any"
              placeholder="0"
              {...register(`lines.${index}.gross_received_quantity`)}
            />
            {fieldErr(errs, 'gross_received_quantity') && (
              <p className="text-destructive mt-1 text-xs">
                {fieldErr(errs, 'gross_received_quantity')}
              </p>
            )}
          </>
        )}
      </td>

      {/* Net received qty */}
      <td className="py-3 pr-3">
        {readOnly ? (
          <span className="tabular-nums font-medium">
            {fmt(net)}{line.uom_symbol_snapshot ? <span className="text-muted-foreground ml-1 text-xs">{line.uom_symbol_snapshot}</span> : null}
          </span>
        ) : (
          <>
            <Input
              type="number"
              min="0.0001"
              max={gross || undefined}
              step="any"
              placeholder="0"
              {...register(`lines.${index}.net_received_quantity`)}
            />
            {fieldErr(errs, 'net_received_quantity') && (
              <p className="text-destructive mt-1 text-xs">
                {fieldErr(errs, 'net_received_quantity')}
              </p>
            )}
          </>
        )}
      </td>

      {/* Variance */}
      <td className={`py-3 pr-3 text-end tabular-nums ${varianceClass(variance)}`}>
        {net > 0 ? (variance >= 0 ? '+' : '') + fmt(variance) : '—'}
      </td>

      {/* Weight photo */}
      <td className="py-3 pr-3">
        {readOnly ? (
          line.weight_photo_path ? (
            <a
              href={line.weight_photo_path}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-xs underline"
            >
              <Camera className="size-3" />
              {t($ => $.lines.viewPhoto)}
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )
        ) : (
          <div className="flex items-center gap-1">
            <input
              ref={photoInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setValue(`lines.${index}.weight_photo`, file, { shouldValidate: true });
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                hasPhoto
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'border-input border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Camera className="size-3" />
              {hasPhoto ? t($ => $.lines.photoAdded) : t($ => $.lines.addPhoto)}
            </button>
            {hasPhoto && (
              <button
                type="button"
                onClick={() => {
                  setValue(`lines.${index}.weight_photo`, null);
                  setValue(`lines.${index}.weight_photo_path`, null);
                  if (photoInputRef.current) photoInputRef.current.value = '';
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}
      </td>

      {/* Notes */}
      <td className="py-3">
        {readOnly ? (
          <span className="text-muted-foreground text-xs">{line.notes || '—'}</span>
        ) : (
          <>
            <Input
              type="text"
              placeholder={t($ => $.lines.notesPlaceholder)}
              {...register(`lines.${index}.notes`)}
            />
            {fieldErr(errs, 'notes') && (
              <p className="text-destructive mt-1 text-xs">{fieldErr(errs, 'notes')}</p>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
