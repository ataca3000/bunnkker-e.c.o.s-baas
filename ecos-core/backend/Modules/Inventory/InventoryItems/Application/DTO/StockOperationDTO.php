<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Shared input for all stock-movement actions (Receive, Reserve, Release, Ship).
 */
final class StockOperationDTO extends BaseDTO
{
    public function __construct(
        public readonly string $warehouse_id,
        public readonly string $product_id,
        public readonly string $company_id,
        public readonly float $quantity,
        public readonly ?string $reference_type = null,
        public readonly ?string $reference_id = null,
        public readonly ?string $notes = null,
        // M-03: allows accountability workflows (liability/waste approval) to deduct
        // on_hand_qty below reserved_qty when confirmed shortage leaves no alternative.
        // Must never be set to true by general adjustment or shipment paths.
        public readonly bool $bypassReserveGuard = false,
        /**
         * Landed unit cost of the stock being moved, when the caller knows it.
         *
         * Goods-receipt posting computes the landed cost per line and passes it
         * through, so the resulting financial event carries the price actually
         * paid rather than a running average. Movements whose caller has no
         * cost leave this null and the action resolves it from Inventory's own
         * cost intelligence — it is never guessed, and never defaulted to zero
         * to make a posting succeed.
         *
         * Placed last so every existing positional caller is unaffected.
         */
        public readonly ?float $unit_cost = null,
        /**
         * Total value of the movement, when the caller finds it more natural to
         * state than a per-unit figure. Either one is enough — the other is
         * arithmetic, not a guess.
         */
        public readonly ?float $total_value = null,
    ) {}

    /**
     * The stated unit cost, deriving it from a stated total when needed.
     *
     * Returns null when nothing was stated. Callers that must value a movement
     * treat that null as a refusal rather than an invitation to substitute an
     * average — see MissingAdjustmentValuationException.
     */
    public function statedUnitCost(): ?float
    {
        if ($this->unit_cost !== null) {
            return $this->unit_cost;
        }

        if ($this->total_value !== null && $this->quantity > 0.0) {
            return round($this->total_value / $this->quantity, 4);
        }

        return null;
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            warehouse_id: (string) $data['warehouse_id'],
            product_id: (string) $data['product_id'],
            company_id: (string) $data['company_id'],
            quantity: (float) $data['quantity'],
            reference_type: isset($data['reference_type']) && $data['reference_type'] !== ''
                                    ? (string) $data['reference_type'] : null,
            reference_id: isset($data['reference_id']) && $data['reference_id'] !== ''
                                    ? (string) $data['reference_id'] : null,
            notes: isset($data['notes']) && $data['notes'] !== ''
                                    ? (string) $data['notes'] : null,
            bypassReserveGuard: (bool) ($data['bypass_reserve_guard'] ?? false),
            unit_cost: isset($data['unit_cost']) && is_numeric($data['unit_cost'])
                                    ? (float) $data['unit_cost'] : null,
            total_value: isset($data['total_value']) && is_numeric($data['total_value'])
                                    ? (float) $data['total_value'] : null,
        );
    }
}
