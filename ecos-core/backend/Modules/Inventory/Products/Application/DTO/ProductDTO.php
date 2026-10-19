<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for creating/updating a product. Property names map directly
 * to the `products` table columns.
 */
final class ProductDTO extends BaseDTO
{
    public function __construct(
        public readonly string $sku,
        public readonly string $name,
        public readonly string $category_id,
        public readonly string $product_type,
        public readonly ?string $brand_id = null,
        public readonly ?string $unit_id = null,
        public readonly string $cost_source = 'purchase',
        public readonly ?string $barcode = null,
        public readonly ?string $description = null,
        public readonly bool $is_active = true,
        public readonly bool $can_manufacture = false,
        public readonly bool $can_disassemble = false,
        public readonly bool $allow_negative_stock = false,
        public readonly ?string $image_url = null,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            sku: (string) $data['sku'],
            name: (string) $data['name'],
            category_id: (string) $data['category_id'],
            product_type: (string) $data['product_type'],
            brand_id: self::nullableString($data, 'brand_id'),
            unit_id: isset($data['unit_id']) && $data['unit_id'] !== '' ? (string) $data['unit_id'] : null,
            cost_source: (string) ($data['cost_source'] ?? 'purchase'),
            barcode: self::nullableString($data, 'barcode'),
            description: self::nullableString($data, 'description'),
            is_active: (bool) ($data['is_active'] ?? true),
            can_manufacture: (bool) ($data['can_manufacture'] ?? false),
            can_disassemble: (bool) ($data['can_disassemble'] ?? false),
            allow_negative_stock: (bool) ($data['allow_negative_stock'] ?? false),
            image_url: self::nullableString($data, 'image_url'),
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function nullableString(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return $value === null || $value === '' ? null : (string) $value;
    }
}
