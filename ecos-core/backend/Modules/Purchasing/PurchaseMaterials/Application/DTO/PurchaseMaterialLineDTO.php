<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseMaterials\Application\DTO;

final class PurchaseMaterialLineDTO
{
    public function __construct(
        public readonly string $product_id,
        public readonly float $requested_qty,
        public readonly ?string $unit_label,
        public readonly ?string $notes,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            product_id: (string) ($data['product_id'] ?? ''),
            requested_qty: (float) ($data['requested_qty'] ?? 0),
            unit_label: isset($data['unit_label']) && $data['unit_label'] !== '' ? (string) $data['unit_label'] : null,
            notes: isset($data['notes']) && $data['notes'] !== '' ? (string) $data['notes'] : null,
        );
    }
}
