<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

use Illuminate\Support\Collection;
use Modules\IAM\Domain\Models\RoleTemplate;

/**
 * Read/write access to the Role Template library (ADR-039). Write operations enforce
 * system-template immutability and append-only versioning.
 */
interface RoleTemplateRepositoryInterface
{
    /** @return Collection<int,RoleTemplate> */
    public function all(): Collection;

    /** @return Collection<int,RoleTemplate> */
    public function forCategory(string $category): Collection;

    /** @return Collection<int,RoleTemplate> */
    public function systemTemplates(): Collection;

    /** @return Collection<int,RoleTemplate> */
    public function customTemplates(): Collection;

    public function findByKey(string $key): ?RoleTemplate;

    /**
     * Idempotently upsert a system template (used by the seeder).
     *
     * @param  array<string,mixed>  $attributes
     */
    public function upsertSystem(string $key, array $attributes): RoleTemplate;

    /**
     * Create a custom (non-system) template.
     *
     * @param  array<string,mixed>  $attributes
     */
    public function createCustom(array $attributes): RoleTemplate;

    /**
     * Update a template's definition/metadata. Refuses system templates.
     *
     * @param  array<string,mixed>  $attributes
     */
    public function update(RoleTemplate $template, array $attributes, ?string $changeNote = null): RoleTemplate;

    /** Clone any template into a new editable custom template. */
    public function clone(RoleTemplate $template, string $newKey, ?string $newName = null): RoleTemplate;

    /** Delete a template. Refuses system templates. */
    public function delete(RoleTemplate $template): void;
}
