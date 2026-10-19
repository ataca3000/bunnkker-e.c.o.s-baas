<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Contracts\SensitiveFieldRegistryInterface;

/**
 * SensitiveFieldRegistry — in-memory map of resource fields to the permission that
 * reveals them (TASK-IAM-002 / ADR-038, Part 2). Registered as a singleton so a
 * module registers its map once per request.
 *
 * Phase-complete but backward compatible: empty by default, so nothing is masked
 * until a module registers a map.
 */
final class SensitiveFieldRegistry implements SensitiveFieldRegistryInterface
{
    /** @var array<string, array<string, string>> resource => (field => permission) */
    private array $map = [];

    public function register(string $resource, array $map): void
    {
        $this->map[$resource] = array_merge($this->map[$resource] ?? [], $map);
    }

    public function permissionFor(string $resource, string $field): ?string
    {
        return $this->map[$resource][$field] ?? null;
    }

    public function fieldsFor(string $resource): array
    {
        return $this->map[$resource] ?? [];
    }
}
