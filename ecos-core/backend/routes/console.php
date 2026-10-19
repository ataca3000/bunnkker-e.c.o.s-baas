<?php

declare(strict_types=1);

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ARCH-003 — Activate Scheduled orders whose delivery date has arrived.
// Runs at 00:05 daily so orders are in the operational queue for the morning shift.
// withoutOverlapping() prevents concurrent runs on large order volumes.
Schedule::command('orders:activate-scheduled')
    ->dailyAt('00:05')
    ->withoutOverlapping()
    ->runInBackground();

// CR-PREP-001 — Auto-create daily preparation sessions for all active warehouses.
// Runs at 06:00 every day; ensureSessionExists() is idempotent so double-runs are safe.
Schedule::command('preparation:create-daily-sessions')
    ->dailyAt('06:00')
    ->withoutOverlapping()
    ->runInBackground();

// CR-PREP-001 Part 3 — Auto-freeze sessions at their configured freeze_time.
// Runs every minute so freeze precision is within 60 s of the configured time.
Schedule::command('preparation:freeze-sessions')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// TASK-META-HARDENING-001 — Provider health checks at three frequencies.
// Hourly: connection validation (credentials still accepted by provider API).
// Every 6 hours: permission depth check.
// Daily: full check including app availability.
Schedule::command('marketing:provider:health-check')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

Schedule::command('marketing:provider:health-check --level=permissions')
    ->everySixHours()
    ->withoutOverlapping()
    ->runInBackground();

Schedule::command('marketing:provider:health-check --level=full')
    ->daily()
    ->withoutOverlapping()
    ->runInBackground();

// TASK-WAVE-ENGINE-001 — Wave Engine lifecycle scheduler.
// Runs every minute; processes all active WaveEngineConfiguration records and
// triggers: collection-window open → order sync → preparation start → wave rotation.
// withoutOverlapping() ensures a slow warehouse does not spawn duplicate runs.
Schedule::command('wave:run-scheduler')
    ->everyMinute()
    ->withoutOverlapping()
    ->runInBackground();

// EPIC-DATA-CONSOLIDATION-001 (007B) — Dual-run validator.
// Reads BOTH the legacy and canonical bases directly (does NOT read or flip any
// feature flag) and reports per-product differences in availability, inventory
// value, and resolved unit cost. This is the pre-cutover validation harness:
// run it in a seeded environment, confirm the differences are explained, then a
// flag may be flipped by the CTO. Read-only.
Artisan::command('inventory:canonical-diff {--limit=100}', function (): int {
    /** @var \Modules\Inventory\InventoryItems\Domain\Services\InventorySummaryService $summarySvc */
    $summarySvc = app(\Modules\Inventory\InventoryItems\Domain\Services\InventorySummaryService::class);

    $limit = (int) $this->option('limit');
    $products = \Modules\Inventory\Products\Domain\Models\Product::query()
        ->orderBy('sku')
        ->limit($limit > 0 ? $limit : 100)
        ->get(['id', 'sku', 'name', 'material_cost', 'current_fifo_cost', 'average_cost', 'last_purchase_cost']);

    $rows = [];
    $availDiffs = 0;
    $valueDiffs = 0;
    $costDiffs = 0;
    $legacyValTotal = 0.0;
    $canonValTotal = 0.0;

    foreach ($products as $p) {
        $id = (string) $p->id;

        // Legacy availability: sum-then-clamp across warehouses.
        $legacyAvail = (float) \Illuminate\Support\Facades\DB::table('inventory_items')
            ->whereNull('deleted_at')->where('product_id', $id)
            ->selectRaw('GREATEST(COALESCE(SUM(on_hand_qty),0) - COALESCE(SUM(reserved_qty),0), 0) as v')
            ->value('v');

        // Legacy value: total on-hand × material_cost.
        $legacyOnHand = (float) \Illuminate\Support\Facades\DB::table('inventory_items')
            ->whereNull('deleted_at')->where('product_id', $id)
            ->selectRaw('COALESCE(SUM(on_hand_qty),0) as q')->value('q');
        $legacyValue = round($legacyOnHand * (float) ($p->material_cost ?? 0), 4);

        // Canonical: InventorySummaryService (clamp-per-warehouse-then-sum) + FIFO value.
        $summary = $summarySvc->summarize($id);
        $canonAvail = $summary->available;
        $canonValue = $summary->inventoryValue;

        // Cost resolution: legacy average-first vs canonical FIFO-first.
        $legacyCost = (float) ($p->average_cost ?? $p->last_purchase_cost ?? $p->current_fifo_cost ?? 0);
        $canonCost = \Modules\CostManagement\Domain\Services\EnterpriseCostEngine::resolveUnitCost($p);

        $aDiff = round($canonAvail - $legacyAvail, 4);
        $vDiff = round($canonValue - $legacyValue, 4);
        $cDiff = round($canonCost - $legacyCost, 4);

        if (abs($aDiff) > 0.0001) {
            $availDiffs++;
        }
        if (abs($vDiff) > 0.0001) {
            $valueDiffs++;
        }
        if (abs($cDiff) > 0.0001) {
            $costDiffs++;
        }
        $legacyValTotal += $legacyValue;
        $canonValTotal += $canonValue;

        if (abs($aDiff) > 0.0001 || abs($vDiff) > 0.0001 || abs($cDiff) > 0.0001) {
            $rows[] = [$p->sku, $legacyAvail, $canonAvail, $aDiff, $legacyValue, $canonValue, $vDiff, $legacyCost, $canonCost, $cDiff];
        }
    }

    $this->info("Canonical consumer dual-run — {$products->count()} products compared (flags stay OFF; both bases read directly).");
    if ($rows === []) {
        $this->line('No differences: legacy == canonical for availability, value and cost across all sampled products.');
    } else {
        $this->table(
            ['SKU', 'Avail(L)', 'Avail(C)', 'dAvail', 'Value(L)', 'Value(C)', 'dValue', 'Cost(L)', 'Cost(C)', 'dCost'],
            $rows,
        );
    }
    $this->line('');
    $this->line("Rows differing — availability: {$availDiffs}, value: {$valueDiffs}, cost: {$costDiffs}");
    $this->line('Total inventory value — legacy: ' . round($legacyValTotal, 2) . ' | canonical(FIFO): ' . round($canonValTotal, 2));
    $this->line('Reasons — availability: sum-then-clamp vs clamp-per-warehouse-then-sum; value: material_cost vs FIFO layers; cost: average-first vs FIFO-first fallback.');

    return 0;
})->purpose('Dual-run diff: legacy vs canonical availability/value/cost per product (EPIC-DATA-CONSOLIDATION-001)');
