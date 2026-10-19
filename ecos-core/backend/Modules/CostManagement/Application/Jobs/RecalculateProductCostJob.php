<?php

declare(strict_types=1);

namespace Modules\CostManagement\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Modules\CostManagement\Application\Services\CostCalculationEngine;
use Modules\CostManagement\Domain\Enums\PricingTriggerReason;
use Modules\CostManagement\Domain\Events\FinishedProductCostChanged;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;
use Throwable;

/**
 * Queue job for asynchronous product cost recalculation — TASK-COST-ARCH-002 Part 13.
 *
 * Flow:
 *   Trigger (material change, receipt posted, etc.)
 *     → RecalculateProductCostJob dispatched to queue
 *       → CostCalculationEngine computes breakdown
 *         → product_cost updated
 *           → FinishedProductCostChanged dispatched
 *             → CostImpactEngine handles pricing review upsert
 *
 * Using queues ensures large material cascades (many products) do not block
 * the HTTP request cycle.
 */
final class RecalculateProductCostJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(
        private readonly string $bomId,
        private readonly string $companyId,
        private readonly PricingTriggerReason $triggerReason,
        private readonly ?string $triggerSource = null,
        private readonly ?string $costHistoryId = null,
    ) {}

    public function handle(CostCalculationEngine $engine): void
    {
        $bom = BillOfMaterial::with(['lines.rawMaterial', 'product.brand'])->find($this->bomId);

        if ($bom === null || ! $bom->is_active) {
            return; // BOM deleted or deactivated between dispatch and execution
        }

        $product = $bom->product;
        if ($product === null) {
            return;
        }

        $previousCost = (float) ($product->product_cost ?? 0.0);

        $summary = $engine->calculateAndPersist($bom);
        $newCost = $summary->finishedProductCost;

        // Update product_cost and unit_cost
        $yieldQty = max((float) ($bom->yield_quantity ?? 1.0), 0.0001);
        $product->update([
            'product_cost' => $newCost,
            'unit_cost' => round($newCost / $yieldQty, 4),
        ]);

        if (abs($newCost - $previousCost) < 0.0001) {
            return; // Cost unchanged — no downstream events needed
        }

        $difference = round($newCost - $previousCost, 4);
        $diffPct = $previousCost > 0
            ? round(($difference / $previousCost) * 100, 4)
            : 0.0;

        FinishedProductCostChanged::dispatch(
            productId: $product->id,
            companyId: $this->companyId,
            oldCost: $previousCost,
            newCost: $newCost,
            difference: $difference,
            differencePercent: $diffPct,
            triggerReason: $this->triggerReason,
            triggerSource: $this->triggerSource,
            occurredAt: now()->toIso8601String(),
            costSnapshot: $summary->toArray(),
            costHistoryId: $this->costHistoryId,
        );

        Log::channel('daily')->info('RecalculateProductCostJob: completed', [
            'bom_id' => $this->bomId,
            'product_id' => $product->id,
            'previous_cost' => $previousCost,
            'new_cost' => $newCost,
            'trigger' => $this->triggerReason->value,
        ]);
    }

    public function failed(Throwable $e): void
    {
        Log::channel('daily')->error('RecalculateProductCostJob: failed', [
            'bom_id' => $this->bomId,
            'error' => $e->getMessage(),
        ]);
    }
}
