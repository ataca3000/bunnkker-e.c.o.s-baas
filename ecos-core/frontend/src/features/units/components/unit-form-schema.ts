import { z } from 'zod';

import type { Unit, UnitPayload } from '@/features/units/types/unit';

export const unitSchema = z.object({
  code: z.string().min(1, 'Code is required.').max(20),
  name: z.string().min(1, 'Name is required.').max(255),
  symbol: z.string().max(20).optional(),
  description: z.string().max(255).optional(),
  is_active: z.boolean(),
});

export type UnitFormValues = z.infer<typeof unitSchema>;

/** Build form values from an existing unit (or empty defaults for create). */
export function toFormValues(unit?: Unit | null): UnitFormValues {
  return {
    code: unit?.code ?? '',
    name: unit?.name ?? '',
    symbol: unit?.symbol ?? '',
    description: unit?.description ?? '',
    is_active: unit?.is_active ?? true,
  };
}

export function toPayload(values: UnitFormValues): UnitPayload {
  return { ...values };
}
