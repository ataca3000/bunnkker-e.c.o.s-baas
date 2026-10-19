import { z } from 'zod';

export const bomLineSchema = z.object({
  raw_material_id: z.string().min(1, 'Raw material is required'),
  quantity: z.number().min(0.0001, 'Quantity must be greater than 0'),
  waste_percentage: z.number().min(0).max(100),
});

export const bomFormSchema = z.object({
  product_id: z.string().min(1, 'Finished good is required'),
  version: z.string().min(1, 'Version is required').max(20),
  is_active: z.boolean(),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(bomLineSchema).min(1, 'At least one material line is required'),
});

export type BomFormValues = z.infer<typeof bomFormSchema>;
