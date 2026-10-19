<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for creating/updating a category. `level` is derived from the
 * parent by the action layer, so it is not part of the DTO input.
 */
final class CategoryDTO extends BaseDTO
{
    public function __construct(
        public readonly string $code,
        public readonly string $name,
        public readonly ?string $parent_id = null,
        public readonly ?string $description = null,
        public readonly int $sort_order = 0,
        public readonly bool $is_active = true,
        public readonly string $category_scope = 'product',
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            code: (string) $data['code'],
            name: (string) $data['name'],
            parent_id: self::nullableString($data, 'parent_id'),
            description: self::nullableString($data, 'description'),
            sort_order: (int) ($data['sort_order'] ?? 0),
            is_active: (bool) ($data['is_active'] ?? true),
            category_scope: (string) ($data['category_scope'] ?? 'product'),
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
