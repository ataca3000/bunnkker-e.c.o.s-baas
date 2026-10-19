# ECOS ERP — Recipe Engine Specification

**Document:** RECIPE-ENGINE-SPEC  
**Version:** 1.0  
**Task:** TASK-MFG-SPEC-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Scope:** Recipe lifecycle, versioning, validation, cost calculation, and disassembly behavior

---

## Overview

The Recipe Engine is the authoritative source for how products are manufactured and disassembled. It defines component relationships, drives manufacturing cost calculation, and governs the reverse disassembly process. It is consumed by the Manufacturing Service and the Decision Engine — it never operates on its own.

The Recipe Engine does **not** trigger manufacturing. It answers questions asked by other engines:
- "Does this product have an active recipe?"
- "What materials are required to make N units?"
- "How much does it cost to manufacture N units at today's costs?"
- "What materials are recovered when N units are disassembled?"

---

## 1. Recipe Aggregate

### 1.1 Recipe

A Recipe belongs to exactly one Product and represents the complete bill of materials required to produce one unit of that product.

**Attributes:**

| Attribute | Type | Rules |
|-----------|------|-------|
| `id` | UUID | System-generated |
| `product_id` | FK → Product | One recipe per product. Cannot be changed after creation. |
| `version` | Integer | Starts at 1. Incremented on every save. Never resets. |
| `is_active` | Boolean | Only one active recipe per product at any time. |
| `notes` | Text | Optional — internal documentation only. Not used in calculations. |
| `created_at` | Timestamp | Immutable. |
| `updated_at` | Timestamp | Updated on every save. |

**Invariants:**

1. A Product can have **at most one** Recipe.
2. A Recipe that has been used in at least one ManufacturingTransaction can be deactivated but **never deleted**.
3. Deactivating a Recipe does not affect existing ManufacturingTransactions — they reference their version snapshot.
4. A Recipe cannot reference the same `product_id` as a component (no self-referencing).
5. A Recipe cannot create a cyclic dependency (Product A → Product B → Product A).

---

### 1.2 RecipeItem (Component Line)

Each RecipeItem represents one input material required per unit of output.

**Attributes:**

| Attribute | Type | Rules |
|-----------|------|-------|
| `id` | UUID | System-generated |
| `recipe_id` | FK → Recipe | Parent recipe |
| `product_id` | FK → Product | The input material/component |
| `quantity` | Decimal (min: 0.001) | Required amount per **one unit** of finished product |
| `unit_id` | FK → Unit | **Read-only** — inherited from the component product's unit. Cannot be edited in the recipe. |
| `sort_order` | Integer | Display order only. No business logic impact. |

**Invariants:**

1. `quantity` must be a positive decimal. Zero and negative values are rejected.
2. `unit_id` must equal the component product's `unit_id`. This is validated on save and cannot be overridden.
3. Percentages are **not supported**. There is no `waste_percentage` or `yield_percentage` field.
4. By-products are **not supported**. A recipe has exactly one output product (the recipe's `product_id`).
5. A component product must be active.
6. Duplicate component products within the same recipe are **not allowed** (combine into a single line instead).

---

## 2. Recipe Lifecycle

### 2.1 Creation

A Recipe can only be created when:
- The product exists and is active.
- `product.can_manufacture = true`.
- No other active recipe exists for that product.

On creation: `version = 1`, `is_active = true`.

### 2.2 Update

Any change to a recipe (add/remove/modify a component, change quantity) triggers a version increment:

```
BEFORE save:
  recipe.version += 1
  recipe.updated_at = now()

SAVE new component state

AFTER save:
  Notify CostEngine: recipe version changed for product_id
  CostEngine recalculates manufacturing cost if cost_source = recipe or hybrid
```

Version history is **not stored** as separate rows. The current row always reflects the latest version. Historical ManufacturingTransactions capture their version number and a JSON snapshot of the recipe components at execution time.

### 2.3 Deactivation

A Recipe is deactivated (not deleted) when:
- The product's `can_manufacture` is set to false.
- The user explicitly deactivates it.
- A replacement recipe is activated (old one is auto-deactivated).

When deactivated:
- In-progress ManufacturingTransactions are not affected.
- Future manufacturing triggers for this product will result in `FAILED_RECIPE_INACTIVE`.

### 2.4 Deletion

A Recipe may only be deleted if **zero** ManufacturingTransactions reference it. In practice, after first use, recipes are deactivated rather than deleted.

---

## 3. Supported Quantity Types

| Type | Description | Example |
|------|-------------|---------|
| **Weight** | Physical weight measured in a weight unit (Kg, g, L, ml) | 0.5 Kg Raw Honey |
| **Quantity** | Discrete item count (Piece, Box, Unit) | 1 Jar, 1 Lid |

**Not Supported:**

| Type | Reason |
|------|--------|
| Percentages | Cannot be resolved without knowing the batch size at design time. Causes ambiguity in cost calculation. |
| Waste percentage | Increases recipe complexity. Modeled by adjusting quantities directly. |
| Yield percentage | Same reason. Adjust output quantity expectations at the order level if needed. |
| By-products | Requires multi-output inventory logic. Not in scope. Separate disassembly handles returns. |

---

## 4. Unit Rules

### 4.1 Inheritance

The unit on a RecipeItem is **always inherited** from the component product's unit. It cannot be changed inside the recipe editor.

**Example:**
- Raw Honey product has unit = "Kg"
- Inside any recipe that uses Raw Honey, the unit will always display as "Kg"
- The user cannot change it to "g" or "Piece" inside the recipe

**Rationale:** The Product Master is the single source of truth for a product's unit. Allowing unit override in recipes would create inconsistency in inventory calculations.

### 4.2 Validation on Save

```
For each RecipeItem being saved:
  component = Product.find(item.product_id)
  if item.unit_id != component.unit_id:
    REJECT save
    RETURN error: "Unit mismatch — component unit must be {component.unit_id}"
```

### 4.3 Unit Change on Product

If a product's unit is changed after recipes have been created (which should be prevented after first inventory transaction), all recipes referencing that product must be revalidated.

---

## 5. Validation Rules

### 5.1 Recipe-Level Validation

| Rule | Error Code | Message |
|------|-----------|---------|
| Product must have `can_manufacture = true` | `RECIPE_PRODUCT_NOT_MANUFACTURABLE` | Product is not configured for manufacturing |
| Product must not already have an active recipe | `RECIPE_ALREADY_EXISTS` | An active recipe already exists for this product |
| Recipe must have at least one component | `RECIPE_NO_COMPONENTS` | A recipe must contain at least one component |
| Recipe output product cannot appear as its own component | `RECIPE_SELF_REFERENCE` | Output product cannot be its own input |
| No cyclic dependencies allowed | `RECIPE_CYCLIC_DEPENDENCY` | This would create a circular recipe dependency |

### 5.2 RecipeItem-Level Validation

| Rule | Error Code | Message |
|------|-----------|---------|
| Quantity must be > 0 | `RECIPE_ITEM_INVALID_QUANTITY` | Component quantity must be greater than zero |
| Component product must exist | `RECIPE_ITEM_PRODUCT_NOT_FOUND` | Component product not found |
| Component product must be active | `RECIPE_ITEM_PRODUCT_INACTIVE` | Component product is inactive |
| Unit must match component product's unit | `RECIPE_ITEM_UNIT_MISMATCH` | Unit must match the component product's configured unit |
| Duplicate component in same recipe | `RECIPE_ITEM_DUPLICATE` | Component already exists in this recipe. Combine into one line. |
| Percentage fields are not accepted | `RECIPE_ITEM_PERCENTAGE_NOT_SUPPORTED` | Percentages are not supported in ECOS Recipe Engine |

### 5.3 Cyclic Dependency Detection Algorithm

```
isCircular(recipe_product_id, component_product_id, visited = []):
  if component_product_id == recipe_product_id:
    return TRUE (cycle detected)
  
  if component_product_id in visited:
    return FALSE (already checked this branch)
  
  visited.add(component_product_id)
  
  child_recipe = Recipe.findActiveByProduct(component_product_id)
  if child_recipe is null:
    return FALSE (no recipe, no cycle possible)
  
  for each item in child_recipe.items:
    if isCircular(recipe_product_id, item.product_id, visited):
      return TRUE
  
  return FALSE
```

---

## 6. Cost Calculation

### 6.1 Manufacturing Cost Formula

```
manufacturingCost(recipe, output_quantity):
  total_cost = 0
  
  for each item in recipe.items:
    component        = Product.find(item.product_id)
    required_qty     = item.quantity × output_quantity
    unit_cost        = component.current_cost          // cost at execution time
    line_cost        = required_qty × unit_cost
    total_cost      += line_cost
  
  return Money(total_cost)
```

### 6.2 Cost Snapshot

At manufacturing execution time, the cost calculation is performed and **stored immutably** on the ManufacturingTransaction. Future cost changes do not alter past transaction costs.

Each `RawMaterialConsumption` line stores:
- `unit_cost` — the component's `current_cost` at execution time
- `quantity` — the actual quantity consumed
- `line_cost` — quantity × unit_cost

### 6.3 Recipe Cost Cascading

When a component product's cost changes, parent products with `cost_source = recipe` or `cost_source = hybrid` must be notified:

```
onComponentCostChanged(component_product_id):
  parent_recipes = Recipe.findAllContainingComponent(component_product_id)
  
  for each parent_recipe in parent_recipes:
    parent_product = Product.find(parent_recipe.product_id)
    
    if parent_product.cost_source in ['recipe', 'hybrid']:
      new_cost = manufacturingCost(parent_recipe, 1)  // per 1 unit
      CostEngine.updateCost(
        product_id     = parent_product.id,
        new_cost       = new_cost,
        source         = 'recipe_component_changed',
        source_doc_id  = component_product_id
      )
      
      // Cascade one more level (direct children only in Phase 1)
      // Multi-level cascading deferred to Phase 2
```

**Phase 1 Limitation:** Cost cascading is one level deep. If A → B → C (A's cost change affects B, B's cost change affects C), Phase 1 only recalculates B. C will be recalculated the next time B's cost is explicitly updated.

---

## 7. Disassembly Rules

### 7.1 Principle

Disassembly is the reverse of the Recipe. There is **no separate Disassembly Recipe**. The system reads the active Recipe for the product and executes it in reverse.

### 7.2 Disassembly Formula

```
disassemble(product_id, quantity):
  recipe = Recipe.findActiveByProduct(product_id)
  
  if recipe is null:
    return FAILED_NO_RECIPE
  
  // Consume the finished product
  Inventory.consume(
    product_id   = product_id,
    quantity     = quantity,
    movement     = DISASSEMBLY_CONSUMPTION
  )
  
  // Recover each component
  for each item in recipe.items:
    recovered_qty = item.quantity × quantity
    Inventory.add(
      product_id   = item.product_id,
      quantity     = recovered_qty,
      unit_cost    = item.product.current_cost,  // current cost at recovery time
      movement     = DISASSEMBLY_PRODUCTION
    )
  
  return DisassemblyTransaction(status = completed)
```

### 7.3 Disassembly Cost Recovery

Recovered materials are **added to inventory at their current cost**, not at the original cost they had when they were originally consumed in manufacturing. This simplifies accounting and avoids the need to trace original FIFO layers from the manufacturing run.

**Rationale:** The original FIFO layers may have been consumed across multiple batches and are impractical to trace back to individual returns.

### 7.4 Disassembly Conditions

| Condition | Action |
|-----------|--------|
| `product.can_disassemble = false` | Skip disassembly. Product returned to finished goods inventory as-is. |
| `recipe = null` | Skip disassembly. Log `FAILED_NO_RECIPE`. Product returned to finished goods. |
| `recipe.is_active = false` | Skip disassembly. Log `FAILED_RECIPE_INACTIVE`. Product returned to finished goods. |
| All conditions met | Execute disassembly. |

### 7.5 Partial Disassembly

Only the **returned quantity** is disassembled — not the full order quantity.

```
Example:
  Order: 10 units of Honey 500g
  Customer returns: 3 units
  
  Disassembly:
    Consume: 3 × Honey 500g
    Recover: 3 × 0.5 Kg Raw Honey = 1.5 Kg
    Recover: 3 × 1 Jar = 3 Jars
    Recover: 3 × 1 Lid = 3 Lids
```

---

## 8. Recipe Engine API Contract

The Recipe Engine exposes the following operations to other engines. These are not HTTP endpoints — they are internal service calls.

| Operation | Input | Output | Used By |
|-----------|-------|--------|---------|
| `resolveRecipe(product_id)` | product_id | Recipe or null | Decision Engine, Manufacturing |
| `hasActiveRecipe(product_id)` | product_id | boolean | Decision Engine |
| `getInputRequirements(recipe, output_qty)` | recipe, decimal | MaterialRequirement[] | Manufacturing, Procurement Queue |
| `calculateManufacturingCost(recipe, output_qty)` | recipe, decimal | Money | Manufacturing, Cost Engine |
| `getRecoveredMaterials(recipe, disassemble_qty)` | recipe, decimal | MaterialRecovery[] | Disassembly |
| `validateRecipe(recipe)` | Recipe draft | ValidationResult | Recipe CRUD |
| `detectCyclicDependency(product_id, component_id)` | two UUIDs | boolean | Recipe CRUD |
| `findRecipesContainingProduct(product_id)` | product_id | Recipe[] | Cost Engine (cascade) |

---

## 9. Existing BillOfMaterial Alignment

The existing codebase contains a `BillOfMaterial` aggregate in the Manufacturing module. The Recipe Engine replaces and extends this:

| BOM (existing) | Recipe Engine (new) | Notes |
|---------------|---------------------|-------|
| `BillOfMaterial.bom_number` | Removed | Internal system ID only |
| `BillOfMaterial.product_id` | `Recipe.product_id` | Same |
| `BillOfMaterial.version` | `Recipe.version` | Same |
| `BillOfMaterial.is_active` | `Recipe.is_active` | Same |
| `BillOfMaterialLine.raw_material_id` | `RecipeItem.product_id` | Renamed — no distinction between raw/finished |
| `BillOfMaterialLine.quantity` | `RecipeItem.quantity` | Same |
| `BillOfMaterialLine.waste_percentage` | **Removed** | Not supported by spec. Percentages not allowed. |
| *(new)* | `RecipeItem.unit_id` | Inherited from product, validated on save |

**Migration note (for Database Design phase):** The `waste_percentage` column must be removed. The `raw_material_id` column will be renamed to `product_id` to reflect the unified product model. Existing BOM data will be migrated as-is (waste percentages discarded).

---

## 10. Constraints Summary

| Constraint | Value |
|-----------|-------|
| Recipes per product | 1 (one active recipe) |
| Components per recipe | 1..∞ (minimum 1) |
| Output products per recipe | 1 (always the recipe's product) |
| By-products | Not supported |
| Percentages | Not supported |
| Cyclic dependencies | Not allowed |
| Unit override in recipe | Not allowed |
| Retroactive recalculation | Not allowed |
| Recipe deletion after use | Not allowed (deactivate only) |
