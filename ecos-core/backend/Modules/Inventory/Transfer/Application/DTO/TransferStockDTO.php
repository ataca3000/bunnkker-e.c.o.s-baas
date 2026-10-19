<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Application\DTO;

/**
 * Input for a single warehouse-to-warehouse stock transfer.
 */
final readonly class TransferStockDTO
{
    public function __construct(
        public string $sourceWarehouseId,
        public string $destinationWarehouseId,
        public string $productId,
        public string $companyId,
        public float $quantity,
        public ?string $reference = null,
        public ?string $notes = null,
        public ?string $actorId = null,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            sourceWarehouseId: (string) $data['source_warehouse_id'],
            destinationWarehouseId: (string) $data['destination_warehouse_id'],
            productId: (string) $data['product_id'],
            companyId: (string) $data['company_id'],
            quantity: (float) $data['quantity'],
            reference: isset($data['reference']) ? (string) $data['reference'] : null,
            notes: isset($data['notes']) ? (string) $data['notes'] : null,
            actorId: isset($data['actor_id']) ? (string) $data['actor_id'] : null,
        );
    }
}
