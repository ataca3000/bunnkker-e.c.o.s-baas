<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

/**
 * SensitiveFieldRegistryInterface — the single map of sensitive fields to the
 * permission that reveals them (TASK-IAM-002 / ADR-038, Part 2).
 *
 * One source of truth drives BOTH the server-side API-Resource mask and the frontend
 * `canViewField()` helper, so they never disagree. Modules register their maps at
 * boot; nothing is sensitive until declared here.
 */
interface SensitiveFieldRegistryInterface
{
    /**
     * Declare the sensitive fields of a resource.
     *
     * @param  string  $resource  e.g. "inventory.products"
     * @param  array<string, string>  $map  field => required permission
     */
    public function register(string $resource, array $map): void;

    /**
     * The required permission for a field, or null if the field is not sensitive.
     */
    public function permissionFor(string $resource, string $field): ?string;

    /**
     * The full field => permission map for a resource.
     *
     * @return array<string, string>
     */
    public function fieldsFor(string $resource): array;
}
