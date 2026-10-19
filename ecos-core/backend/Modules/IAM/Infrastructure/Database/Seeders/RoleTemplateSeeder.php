<?php

declare(strict_types=1);

namespace Modules\IAM\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\IAM\Domain\Catalog\RoleTemplateCatalog;
use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;

/**
 * Seeds the 40 official ECOS system role templates (TASK-IAM-003 / ADR-039).
 * Idempotent — re-running only creates a new immutable version when a definition changes.
 */
class RoleTemplateSeeder extends Seeder
{
    public function run(): void
    {
        /** @var RoleTemplateRepositoryInterface $repository */
        $repository = app(RoleTemplateRepositoryInterface::class);

        foreach (RoleTemplateCatalog::all() as $template) {
            $repository->upsertSystem($template['key'], [
                'name' => $template['name'],
                'description' => $template['description'],
                'category' => $template['category'],
                'definition' => $template['definition'],
                'is_composable' => true,
            ]);
        }
    }
}
