import { z } from 'zod';

export const recipeLineSchema = z.object({
  raw_material_id:  z.string().min(1, 'Material is required'),
  quantity:         z.number().min(0.0001, 'Quantity must be greater than 0'),
  waste_percentage: z
    .number()
    .min(0, 'Waste % cannot be negative')
    .max(99.99, 'Waste % must be less than 100'),
});

export const recipeFormSchema = z.object({
  product_id:              z.string().min(1, 'Product is required'),
  notes:                   z.string().max(2000).nullable().optional(),
  execution_instructions:  z.string().max(5000).nullable().optional(),
  manufacturing_cost:      z.number().min(0, 'Manufacturing cost cannot be negative'),
  other_costs:             z.number().min(0, 'Other costs cannot be negative'),
  yield_quantity:          z.number().min(0.0001, 'Yield must be greater than 0'),
  lines:                   z.array(recipeLineSchema).min(1, 'At least one material is required'),
});

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;
