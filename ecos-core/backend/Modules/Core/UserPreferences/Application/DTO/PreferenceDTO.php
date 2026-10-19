<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Application\DTO;

use App\Core\DTO\BaseDTO;

/**
 * Carries a validated preference upsert request from the HTTP layer to the
 * application service. Framework-agnostic and safe to unit-test without Laravel.
 */
final class PreferenceDTO extends BaseDTO
{
    /**
     * @param  string  $category  Preference namespace, e.g. 'products'
     * @param  array<string, mixed>  $payload  The preference data
     */
    public function __construct(
        public readonly string $category,
        public readonly array $payload,
    ) {}

    /**
     * @param  array{category: string, payload: array<string, mixed>}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            category: (string) ($data['category'] ?? ''),
            payload: (array) ($data['payload'] ?? []),
        );
    }
}
