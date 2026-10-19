/**
 * ADR-RECIPE-001 — Shared RecipeCostCalculator
 *
 * Single source of truth for recipe cost computation across all ECOS modules.
 * Every operational screen (Recipes, Products, Manufacturing, Pricing, Reports)
 * must use these functions — never implement a separate cost formula.
 *
 * Formula:
 *   Recipe Cost = Raw Material Cost + Packaging Material Cost
 *               + Manufacturing Cost + Other Costs
 *
 * Where per-line material cost:
 *   Line Cost = unit_material_cost × quantity × (1 + waste_percentage / 100)
 */

export type CostableLine = {
  quantity: number;
  waste_percentage?: number | null;
  raw_material?: {
    material_cost?: number | null;
    product_type?: string | null;
  } | null;
};

export type RecipeCostBreakdown = {
  rawMaterialCost:   number;
  packagingCost:     number;
  manufacturingCost: number;
  otherCosts:        number;
  /** Total = all four components above. */
  recipeCost:        number;
};

/**
 * Compute a full recipe cost breakdown from lines that already embed the
 * raw_material object (detail views, read-only drawers).
 */
export function calcRecipeCost(
  lines: CostableLine[],
  manufacturingCost: number,
  otherCosts: number,
): RecipeCostBreakdown {
  let rawMaterialCost = 0;
  let packagingCost   = 0;

  for (const line of lines) {
    const unitCost     = line.raw_material?.material_cost ?? 0;
    const qty          = line.quantity || 0;
    const waste        = line.waste_percentage ?? 0;
    const lineTotal    = qty * (1 + waste / 100) * unitCost;

    if (line.raw_material?.product_type === 'packaging_material') {
      packagingCost += lineTotal;
    } else {
      rawMaterialCost += lineTotal;
    }
  }

  return {
    rawMaterialCost,
    packagingCost,
    manufacturingCost,
    otherCosts,
    recipeCost: rawMaterialCost + packagingCost + manufacturingCost + otherCosts,
  };
}

/**
 * Adapter for form-editing screens where lines hold a `raw_material_id` and
 * costs are looked up via a Map (recipe workspace).
 */
export function calcRecipeCostFromFormLines(
  lines: Array<{ raw_material_id: string; quantity: number; waste_percentage?: number | null }>,
  rmMap: Map<string, { material_cost?: number | null; product_type?: string | null }>,
  manufacturingCost: number,
  otherCosts: number,
): RecipeCostBreakdown {
  return calcRecipeCost(
    lines.map((l) => {
      const m = rmMap.get(l.raw_material_id);
      return {
        quantity:         l.quantity,
        waste_percentage: l.waste_percentage,
        raw_material:     m ? { material_cost: m.material_cost, product_type: m.product_type } : null,
      };
    }),
    manufacturingCost,
    otherCosts,
  );
}

/**
 * Compute total recipe cost from stored/cached values (table rows, summary
 * cards) where lines are not loaded. Valid per ADR-RECIPE-001 for reporting
 * and list-view aggregations only.
 *
 * Note: storedMaterialsCost = recipe_cost column (raw + packaging only).
 */
export function calcTotalFromStored(
  storedMaterialsCost: number,
  manufacturingCost: number,
  otherCosts: number,
): number {
  return storedMaterialsCost + manufacturingCost + otherCosts;
}
