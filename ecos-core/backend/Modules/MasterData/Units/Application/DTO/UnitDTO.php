<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Immutable input for creating/updating a unit of measure. Property names map
 * directly to the `units` table columns.
 */
final class UnitDTO extends BaseDTO
{
    public function __construct(
        public readonly string $code,
        public readonly string $name,
        public readonly ?string $symbol = null,
        public readonly ?string $description = null,
        public readonly bool $is_active = true,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            code: (string) $data['code'],
            name: (string) $data['name'],
            symbol: self::nullableString($data, 'symbol'),
            description: self::nullableString($data, 'description'),
            is_active: (bool) ($data['is_active'] ?? true),
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
