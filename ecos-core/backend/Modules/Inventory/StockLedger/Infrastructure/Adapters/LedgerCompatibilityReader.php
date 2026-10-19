<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Infrastructure\Adapters;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Modules\Inventory\InventoryItems\Domain\Models\StockLedgerEntry;

/**
 * Ledger compatibility layer — EPIC-DATA-CONSOLIDATION-001, Phase A.
 *
 * Reads the CANONICAL append-only ledger (stock_ledger_entries) and emits rows in
 * the EXACT shape the legacy StockMovementResource produces, so the public
 * GET /stock-movements contract is preserved byte-for-byte while the underlying
 * source is the single source of truth.
 *
 * Wired behind a default-OFF config flag (config('inventory_ledger.canonical_reads')),
 * enabling a gradual, per-environment cutover after validation — no endpoint break.
 *
 * Field mapping (ledger → movement shape):
 *   on_hand_before → balance_before   on_hand_after → balance_after
 *   created_at     → movement_date    movement_type → movement_type + _label
 */
final class LedgerCompatibilityReader
{
    private const SORTABLE = ['movement_date', 'quantity', 'movement_type', 'created_at'];

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = StockLedgerEntry::query()->with(['warehouse', 'product']);

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $query->where(function (Builder $b) use ($search): void {
                $b->whereHas('product', function (Builder $q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%");
                })->orWhereHas('warehouse', function (Builder $q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%");
                });
            });
        }

        if (($productId = trim((string) ($filters['product_id'] ?? ''))) !== '') {
            $query->where('product_id', $productId);
        }

        if (($warehouseId = trim((string) ($filters['warehouse_id'] ?? ''))) !== '') {
            $query->where('warehouse_id', $warehouseId);
        }

        $movementType = trim((string) ($filters['movement_type'] ?? ''));
        if ($movementType !== '' && $movementType !== 'all') {
            $query->where('movement_type', $movementType);
        }

        if (($dateFrom = trim((string) ($filters['date_from'] ?? ''))) !== '') {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if (($dateTo = trim((string) ($filters['date_to'] ?? ''))) !== '') {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        if (! in_array($sortBy, self::SORTABLE, true)) {
            $sortBy = 'created_at';
        }
        if ($sortBy === 'movement_date') {
            $sortBy = 'created_at';
        }

        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $perPage = max(1, min((int) ($filters['per_page'] ?? 10), 100));

        $paginator = $query->orderBy($sortBy, $sortDir)->paginate($perPage);

        $paginator->getCollection()->transform(fn (StockLedgerEntry $e): array => $this->toMovementShape($e));

        return $paginator;
    }

    /**
     * @return array<string, mixed>
     */
    private function toMovementShape(StockLedgerEntry $e): array
    {
        return [
            'id' => $e->id,
            'warehouse_id' => $e->warehouse_id,
            'warehouse' => $e->warehouse ? [
                'id' => $e->warehouse->id,
                'code' => $e->warehouse->code,
                'name' => $e->warehouse->name,
            ] : null,
            'product_id' => $e->product_id,
            'product' => $e->product ? [
                'id' => $e->product->id,
                'sku' => $e->product->sku,
                'name' => $e->product->name,
            ] : null,
            'movement_type' => $e->movement_type->value,
            'movement_type_label' => $e->movement_type->label(),
            'quantity' => (float) $e->quantity,
            'balance_before' => (float) $e->on_hand_before,
            'balance_after' => (float) $e->on_hand_after,
            'reference_type' => $e->reference_type,
            'reference_id' => $e->reference_id,
            'movement_date' => $e->created_at?->toDateString(),
            'notes' => $e->notes,
            'created_at' => $e->created_at?->toIso8601String(),
        ];
    }
}
