<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Illuminate\Support\Collection;
use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;
use Modules\IAM\Domain\Enums\RoleTemplateStatus;
use Modules\IAM\Domain\Exceptions\SystemTemplateImmutableException;
use Modules\IAM\Domain\Models\RoleTemplate;

/**
 * Persistence for the Role Template library (ADR-039).
 * Enforces system-template immutability and append-only versioning.
 */
class RoleTemplateRepository implements RoleTemplateRepositoryInterface
{
    public function __construct(private readonly RoleTemplateVersionService $versions) {}

    public function all(): Collection
    {
        return RoleTemplate::query()->orderBy('category')->orderBy('name')->get();
    }

    public function forCategory(string $category): Collection
    {
        return RoleTemplate::query()->where('category', $category)->orderBy('name')->get();
    }

    public function systemTemplates(): Collection
    {
        return RoleTemplate::query()->where('is_system', true)->orderBy('name')->get();
    }

    public function customTemplates(): Collection
    {
        return RoleTemplate::query()->where('is_system', false)->orderBy('name')->get();
    }

    public function findByKey(string $key): ?RoleTemplate
    {
        return RoleTemplate::query()->where('key', $key)->first();
    }

    public function upsertSystem(string $key, array $attributes): RoleTemplate
    {
        $template = RoleTemplate::firstOrNew(['key' => $key]);
        $existed = $template->exists;
        $definitionChanged = $existed && $template->definition != ($attributes['definition'] ?? []);

        $template->fill([
            'name' => $attributes['name'],
            'description' => $attributes['description'] ?? null,
            'category' => $attributes['category'],
            'is_composable' => $attributes['is_composable'] ?? true,
            'definition' => $attributes['definition'] ?? [],
        ]);
        $template->is_system = true;
        $template->status = RoleTemplateStatus::PUBLISHED->value;

        if (! $existed) {
            $template->version = 1;
            $template->published_at = now();
        } elseif ($definitionChanged) {
            $template->version = $template->version + 1;
            $template->published_at = now();
        }

        $template->save();
        $this->versions->snapshot($template, $existed ? 'system template updated' : 'initial system template');

        return $template->refresh();
    }

    public function createCustom(array $attributes): RoleTemplate
    {
        $template = new RoleTemplate([
            'key' => $attributes['key'],
            'name' => $attributes['name'],
            'description' => $attributes['description'] ?? null,
            'category' => $attributes['category'],
            'is_composable' => $attributes['is_composable'] ?? true,
            'definition' => $attributes['definition'] ?? [],
            'created_by' => $attributes['created_by'] ?? null,
        ]);
        $template->is_system = false;
        $template->status = RoleTemplateStatus::DRAFT->value;
        $template->version = 1;
        $template->save();

        $this->versions->snapshot($template, 'custom template created', $attributes['created_by'] ?? null);

        return $template->refresh();
    }

    public function update(RoleTemplate $template, array $attributes, ?string $changeNote = null): RoleTemplate
    {
        $this->guardSystem($template);

        $template->fill(array_intersect_key($attributes, array_flip([
            'name', 'description', 'category', 'is_composable', 'definition', 'status', 'updated_by',
        ])));
        $template->version = $template->version + 1;
        $template->save();

        $this->versions->snapshot($template, $changeNote ?? 'template updated', $attributes['updated_by'] ?? null);

        return $template->refresh();
    }

    public function clone(RoleTemplate $template, string $newKey, ?string $newName = null): RoleTemplate
    {
        return $this->createCustom([
            'key' => $newKey,
            'name' => $newName ?? ('Copy of '.$template->name),
            'description' => $template->description,
            'category' => $template->category,
            'is_composable' => $template->is_composable,
            'definition' => $template->definition,
        ]);
    }

    public function delete(RoleTemplate $template): void
    {
        $this->guardSystem($template);
        $template->delete();
    }

    private function guardSystem(RoleTemplate $template): void
    {
        if ($template->is_system) {
            throw SystemTemplateImmutableException::forKey($template->key);
        }
    }
}
