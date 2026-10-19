<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Canonical ledger reads (EPIC-DATA-CONSOLIDATION-001, Phase A)
    |--------------------------------------------------------------------------
    |
    | When true, GET /stock-movements is served from the canonical, append-only
    | stock_ledger_entries table via the compatibility layer (identical JSON shape)
    | instead of the legacy stock_movements table. Default OFF so the endpoint is
    | unchanged until each environment validates the canonical output.
    |
    */
    'canonical_reads' => (bool) env('INVENTORY_CANONICAL_LEDGER_READS', false),

    /*
    |--------------------------------------------------------------------------
    | Canonical inventory summary (EPIC-DATA-CONSOLIDATION-001, Phase B/D)
    |--------------------------------------------------------------------------
    |
    | When true, the product-list repository computes availability with the
    | canonical CLAMP-PER-WAREHOUSE-THEN-SUM rule and values inventory on the
    | canonical FIFO basis (Σ remaining_qty × landed_unit_cost over open receipt
    | layers) — identical to InventorySummaryService / EnterpriseCostEngine.
    |
    | Default OFF so the list endpoint's numbers are byte-identical to the
    | legacy sum-then-clamp + material_cost basis until each environment
    | validates the canonical output against seeded data, then flips the flag.
    |
    */
    'canonical_summary' => (bool) env('INVENTORY_CANONICAL_SUMMARY', false),

    /*
    |--------------------------------------------------------------------------
    | Canonical cost resolution (EPIC-DATA-CONSOLIDATION-001, Phase C/D)
    |--------------------------------------------------------------------------
    |
    | When true, consumers that need a single "best available" unit cost resolve
    | it through EnterpriseCostEngine::resolveUnitCost() using the canonical
    | FIFO-first fallback order (current_fifo_cost → average_cost →
    | last_purchase_cost → 0) instead of their local average-first chains.
    |
    | Default OFF so cost-valued records (count adjustments, manual stock layers)
    | keep their existing average-first values until seeded dual-run validation.
    |
    */
    'canonical_cost_resolution' => (bool) env('INVENTORY_CANONICAL_COST_RESOLUTION', false),
];
