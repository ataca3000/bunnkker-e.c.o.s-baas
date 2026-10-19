<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Infrastructure\Repositories;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Modules\CostManagement\Application\Services\CostCalculationEngine;
use Modules\CostManagement\Domain\Enums\PricingTriggerReason;
use Modules\CostManagement\Domain\Events\FinishedProductCostChanged;
use Modules\CostManagement\Domain\Services\PricingReviewService;
use Modules\Manufacturing\BillsOfMaterials\Domain\Contracts\BomRepositoryInterface;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

final class EloquentBomRepository implements BomRepositoryInterface
{
    private const PER_PAGE = 20;

    public function __construct(
        private readonly CostCalculationEngine $costCalculationEngine,
        private readonly PricingReviewService $pricingReviewService,
    ) {}

    /**
     * Relations for list endpoints — no lines, but includes withTrashed on category
     * so that soft-deleted categories still display instead of appearing null.
     *
     * @return array<int|string, mixed>
     */
    private function getWith(): array
    {
        return [
            'product.channelMappings.channel.brand.company',
            'product.category' => fn ($q) => $q->withTrashed(),
        ];
    }

    /**
     * Relations for detail/create/update endpoints — includes lines with raw material data.
     *
     * @return array<int|string, mixed>
     */
    private function getWithDetail(): array
    {
        return [
            'product.channelMappings.channel.brand.company',
            'product.category' => fn ($q) => $q->withTrashed(),
            'lines.rawMaterial.unit',
        ];
    }

    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = BillOfMaterial::with($this->getWith())
            ->withCount('lines')
            ->addSelect([
                'bills_of_materials.*',
                DB::raw(
                    '(SELECT COALESCE(SUM(l.quantity * l.waste_percentage) / NULLIF(SUM(l.quantity), 0), 0)'
                    .' FROM bill_of_material_lines l'
                    .' WHERE l.bom_id = bills_of_materials.id) AS total_waste_pct',
                ),
            ]);

        $search = trim((string) ($filters['search'] ?? ''));

        if ($search !== '') {
            $query->where(function ($q) use ($search): void {
                $q->where('bom_number', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%"));
            });
        }

        if (isset($filters['product_id']) && $filters['product_id'] !== '') {
            $query->where('product_id', (string) $filters['product_id']);
        }

        $companyId = trim((string) ($filters['company_id'] ?? ''));
        if ($companyId !== '') {
            $query->whereHas(
                'product.channelMappings.channel',
                fn ($q) => $q->where('company_id', $companyId),
            );
        }

        $channelId = trim((string) ($filters['channel_id'] ?? ''));
        if ($channelId !== '') {
            $query->whereHas(
                'product.channelMappings',
                fn ($q) => $q->where('channel_id', $channelId),
            );
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== 'all') {
            $query->where('is_active', (bool) $filters['is_active']);
        }

        if (! empty($filters['has_manufacturing_cost'])) {
            $query->where('manufacturing_cost', '>', 0);
        }

        if (! empty($filters['has_packaging_materials'])) {
            $query->whereHas('lines.rawMaterial', fn ($q) => $q->where('product_type', 'packaging_material'));
        }

        if (! empty($filters['updated_from'])) {
            $query->where('updated_at', '>=', $filters['updated_from']);
        }

        if (! empty($filters['updated_to'])) {
            $query->where('updated_at', '<=', $filters['updated_to'].' 23:59:59');
        }

        $sortDir = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        match ($filters['sort_by'] ?? '') {
            'bom_number' => $query->orderBy('bills_of_materials.bom_number', $sortDir),
            'version' => $query->orderBy('bills_of_materials.version', $sortDir),
            'recipe_cost' => $query->orderBy('bills_of_materials.recipe_cost', $sortDir),
            'total_waste_pct' => $query->orderBy('total_waste_pct', $sortDir),
            'lines_count' => $query->orderBy('lines_count', $sortDir),
            'updated_at' => $query->orderBy('bills_of_materials.updated_at', $sortDir),
            'product_name' => $query->orderByRaw(
                "(SELECT name FROM products WHERE id = bills_of_materials.product_id) {$sortDir}",
            ),
            'category' => $query->orderByRaw(
                '(SELECT c.name FROM categories c'
                .' JOIN products p ON p.category_id = c.id'
                ." WHERE p.id = bills_of_materials.product_id) {$sortDir}",
            ),
            default => $query->orderBy('bills_of_materials.created_at', $sortDir),
        };

        return $query->paginate((int) ($filters['per_page'] ?? self::PER_PAGE));
    }

    public function findById(string $id): ?BillOfMaterial
    {
        return BillOfMaterial::with($this->getWithDetail())->find($id);
    }

    public function create(array $attributes, array $lines): BillOfMaterial
    {
        if ($attributes['is_active'] ?? false) {
            $this->deactivateOthers((string) $attributes['product_id'], null);
        }

        $bom = BillOfMaterial::create($attributes);
        $bom->lines()->createMany($lines);
        $this->recomputeRecipeCost($bom);

        return $bom->load($this->getWithDetail());
    }

    public function update(BillOfMaterial $bom, array $attributes, ?array $lines): BillOfMaterial
    {
        if ($attributes['is_active'] ?? false) {
            $this->deactivateOthers((string) $attributes['product_id'], $bom->id);
        }

        $bom->update($attributes);

        // Only touch the lines when the caller actually supplied them. A status
        // change sends no `lines` key, and must never destroy the recipe.
        if ($lines !== null) {
            $bom->lines()->delete();
            $bom->lines()->createMany($lines);
        }

        $this->recomputeRecipeCost($bom);

        return $bom->load($this->getWithDetail());
    }

    public function delete(BillOfMaterial $bom): void
    {
        $bom->delete();
    }

    public function nextVersionNumber(string $productId): int
    {
        $max = BillOfMaterial::withTrashed()
            ->where('product_id', $productId)
            ->max('bom_version_number');

        return ($max === null ? 0 : (int) $max) + 1;
    }

    public function nextBomNumber(): string
    {
        $last = BillOfMaterial::withTrashed()
            ->where('bom_number', 'like', 'BOM-%')
            ->orderByRaw("CAST(REPLACE(bom_number, 'BOM-', '') AS UNSIGNED) DESC")
            ->value('bom_number');

        if ($last === null) {
            return 'BOM-00001';
        }

        $current = (int) str_replace('BOM-', '', (string) $last);

        return 'BOM-'.str_pad((string) ($current + 1), 5, '0', STR_PAD_LEFT);
    }

    /**
     * Recompute and persist the full cost breakdown for a BOM using CostCalculationEngine,
     * then cascade to product_cost when this BOM is the active recipe.
     *
     * Separates raw material cost from packaging cost and stores the full
     * RecipeCostSummaryDTO as cost_summary JSON (TASK-COST-ARCH-002 Part 1).
     */
    private function recomputeRecipeCost(BillOfMaterial $bom): void
    {
        // Reload lines with raw material data needed by the engine
        $bom->load(['lines.rawMaterial', 'product.brand']);

        $summary = $this->costCalculationEngine->calculateAndPersist(
            $bom,
            triggerType: 'recipe_edit',
            triggerSource: $bom->bom_number,
        );

        // Cascade to product_cost only when this recipe is the active one.
        // Inactive/draft BOMs must not affect the product's published cost.
        if (! $bom->is_active) {
            return;
        }

        $product = $bom->product;
        if ($product === null) {
            return;
        }

        $previousCost = (float) ($product->product_cost ?? 0.0);
        $newCost = $summary->finishedProductCost;
        $yieldQty = max((float) ($bom->yield_quantity ?? 1.0), 0.0001);

        $product->update([
            'product_cost' => $newCost,
            'unit_cost' => round($newCost / $yieldQty, 4),
        ]);

        $companyId = $product->brand?->company_id;
        if ($companyId === null || abs($newCost - $previousCost) < 0.0001) {
            return;
        }

        $difference = round($newCost - $previousCost, 4);
        $diffPct = $previousCost > 0
            ? round(($difference / $previousCost) * 100, 4)
            : 0.0;

        $this->pricingReviewService->upsertForProduct(
            product: $product,
            newProductCost: $newCost,
            previousProductCost: $previousCost,
            companyId: (string) $companyId,
            historyId: null,
            triggerReason: PricingTriggerReason::RecipeUpdated->value,
            triggerSource: $bom->bom_number,
            costSnapshot: $summary->toArray(),
        );

        FinishedProductCostChanged::dispatch(
            productId: $product->id,
            companyId: (string) $companyId,
            oldCost: $previousCost,
            newCost: $newCost,
            difference: $difference,
            differencePercent: $diffPct,
            triggerReason: PricingTriggerReason::RecipeUpdated,
            triggerSource: $bom->bom_number,
            occurredAt: now()->toIso8601String(),
            costSnapshot: $summary->toArray(),
        );
    }

    private function deactivateOthers(string $productId, ?string $excludeId): void
    {
        $query = BillOfMaterial::where('product_id', $productId)->where('is_active', true);

        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        $query->update(['is_active' => false]);
    }
}
