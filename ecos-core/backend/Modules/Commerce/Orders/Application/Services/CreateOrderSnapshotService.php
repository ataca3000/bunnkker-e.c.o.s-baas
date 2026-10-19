<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Services;

use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Orders\Application\Actions\ResolveProductPricingAction;
use Modules\Commerce\Orders\Application\Adapters\OrderBusinessContextAdapter;
use Modules\Commerce\Orders\Application\Adapters\OrderFinancialSnapshotAdapter;
use Modules\Commerce\Orders\Application\Adapters\OrderSnapshotPersistenceAdapter;
use Modules\Commerce\Orders\Domain\Exceptions\SnapshotConsistencyException;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderFinancialSnapshot;
use Modules\Common\Snapshots\Application\Services\SnapshotManager;
use Modules\Common\Snapshots\Domain\Engine\IntegrityEngine;
use Modules\Common\Snapshots\Domain\Exceptions\SnapshotConsistencyException as PlatformConsistencyException;
use Modules\CostManagement\Application\Services\CostCalculationEngine;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

/**
 * Thin wrapper: builds Order-specific line data then delegates snapshot
 * creation to the platform SnapshotManager.
 *
 * BOM lookups + cost calculations remain here because they are strictly
 * Order-domain concerns. All aggregation, margin computation, hash generation,
 * and persistence are handled by the platform layer.
 *
 * TRIGGER: Called only when an order transitions to 'confirm_order' status.
 * Idempotent — subsequent calls return null if a snapshot already exists.
 *
 * REPORTING CONTRACT (ADR-020/ADR-021):
 *   Downstream reports MUST query order_financial_snapshots + order_line_snapshots.
 *   Never join products/recipes for historical financial data.
 */
final class CreateOrderSnapshotService
{
    public function __construct(
        private readonly CostCalculationEngine $costEngine,
        private readonly ResolveProductPricingAction $pricingAction,
        private readonly SnapshotManager $snapshotManager,
        private readonly IntegrityEngine $integrityEngine,
    ) {}

    /**
     * Create the financial snapshot if one does not already exist for this order.
     * Returns the new snapshot, or null if one already existed.
     *
     * @throws SnapshotConsistencyException
     */
    public function createIfAbsent(Order $order): ?OrderFinancialSnapshot
    {
        if (OrderFinancialSnapshot::where('order_id', $order->id)->exists()) {
            return null;
        }

        $order->loadMissing(['lines.product.brand', 'lines.product.activeRecipe', 'channel.brand', 'customer']);

        $companyId = Auth::user()?->company_id;
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        $lineData = $this->buildLineData($order, $companyId);

        $contextAdapter = new OrderBusinessContextAdapter($order, $actorId, $companyId);
        $financialAdapter = new OrderFinancialSnapshotAdapter($order, $lineData, $companyId, $actorId);
        $persistenceAdapter = new OrderSnapshotPersistenceAdapter($order, $actorId);

        try {
            $this->snapshotManager->createFor($contextAdapter, $financialAdapter, $persistenceAdapter, $actorId);
        } catch (PlatformConsistencyException $e) {
            // Re-throw as the Orders exception so existing test/listener code continues to work.
            throw new SnapshotConsistencyException($e->getMessage(), 0, $e);
        }

        return OrderFinancialSnapshot::where('order_id', $order->id)->first();
    }

    /**
     * Verify the stored SHA-256 hash against a persisted snapshot record.
     * Called from the controller to populate hash_verified on API responses.
     */
    public function verifyIntegrityHash(OrderFinancialSnapshot $snapshot): bool
    {
        if ($snapshot->integrity_hash === null) {
            return false;
        }

        $snapshot->loadMissing('lines');

        $lineParts = $snapshot->lines->map(
            static fn ($line) => implode(':', [
                $line->product_id ?? '',
                number_format((float) ($line->quantity ?? 0), 4, '.', ''),
                number_format((float) ($line->unit_price_at_sale ?? 0), 4, '.', ''),
                number_format((float) ($line->line_total ?? 0), 4, '.', ''),
            ]),
        )->all();

        usort($lineParts, static fn ($a, $b) => strcmp($a, $b));

        $canonical = implode('|', [
            $snapshot->order_id,
            number_format((float) ($snapshot->grand_total ?? 0), 4, '.', ''),
            number_format((float) ($snapshot->subtotal ?? 0), 4, '.', ''),
            number_format((float) ($snapshot->discount_amount ?? 0), 4, '.', ''),
            number_format((float) ($snapshot->shipping_cost ?? 0), 4, '.', ''),
            implode(',', $lineParts),
        ]);

        return $this->integrityEngine->verify($snapshot->integrity_hash, $canonical);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Pre-compute all per-line data as plain arrays.
     * This is the only Order-specific logic remaining in this service.
     * BOM resolution + cost engine + pricing action are domain-specific concerns.
     */
    private function buildLineData(Order $order, ?string $companyId): array
    {
        $lines = [];

        foreach ($order->lines as $line) {
            $bom = BillOfMaterial::where('product_id', $line->product_id)
                ->where('is_active', true)
                ->first();

            $costSummary = null;
            $unitCost = null;
            $bomVersionNumber = null;
            $recipeVersion = null;

            if ($bom !== null) {
                $costSummary = $this->costEngine->calculate($bom);
                $unitCost = $costSummary->finishedProductCost;
                $bomVersionNumber = $bom->bom_version_number;
                $recipeVersion = $bom->version ?? null;
            }

            $pricing = $this->pricingAction->execute($line->product_id, $companyId);

            $lineCost = $unitCost !== null ? round($unitCost * $line->quantity, 4) : null;
            $grossProfit = $lineCost !== null ? round($line->line_total - $lineCost, 4) : null;
            $marginPct = ($grossProfit !== null && $line->line_total > 0.0)
                ? round(($grossProfit / $line->line_total) * 100.0, 4)
                : null;

            $targetMargin = $line->product?->effectiveTargetMargin() ?? 30.0;

            [$reviewId, $reviewApprovedAt, $reviewApprovedBy] =
                $this->resolveReview($line->product_id, $companyId);

            $lines[] = [
                'order_id' => $line->order_id,
                'order_line_id' => $line->id,
                'product_id' => $line->product_id,
                'product_sku' => $line->product?->sku,
                'product_name' => $line->product?->name,
                'quantity' => $line->quantity,
                'unit_price_at_sale' => $line->unit_price,
                'regular_price_at_sale' => $pricing['regular_price'],
                'sale_price_at_sale' => $pricing['sale_price'],
                'line_total' => $line->line_total,
                'raw_material_cost' => $costSummary?->rawMaterialCost,
                'packaging_cost' => $costSummary?->packagingCost,
                'manufacturing_cost' => $costSummary?->manufacturingCost,
                'other_cost' => $costSummary?->otherCost,
                'recipe_cost' => $costSummary?->recipeCost,
                'unit_cost' => $unitCost,
                'line_cost' => $lineCost,
                'target_margin_percent' => $targetMargin,
                'bom_id' => $bom?->id,
                'bom_version_number' => $bomVersionNumber,
                'source_recipe_version' => $recipeVersion,
                'price_review_id' => $reviewId,
                'price_review_approved_at' => $reviewApprovedAt,
                'price_review_approved_by' => $reviewApprovedBy,
                'cost_snapshot' => $costSummary?->toArray(),
            ];
        }

        return $lines;
    }

    /** @return array{string|null, string|null, string|null} */
    private function resolveReview(string $productId, ?string $companyId): array
    {
        if ($companyId === null) {
            return [null, null, null];
        }

        $review = \Modules\CostManagement\Domain\Models\PricingReview::where('product_id', $productId)
            ->where('company_id', $companyId)
            ->whereIn('status', [
                \Modules\CostManagement\Domain\Enums\PricingReviewStatus::Approved->value,
                \Modules\CostManagement\Domain\Enums\PricingReviewStatus::Kept->value,
                \Modules\CostManagement\Domain\Enums\PricingReviewStatus::CustomPrice->value,
            ])
            ->whereNotNull('resolved_at')
            ->orderByDesc('resolved_at')
            ->first();

        if ($review === null) {
            return [null, null, null];
        }

        return [
            $review->id,
            $review->resolved_at?->toIso8601String(),
            null,
        ];
    }
}
