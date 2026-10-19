<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Models\RoleTemplate;

/**
 * Exports a role template to a portable JSON structure (ADR-039).
 * Includes metadata, version, and the full definition — enough to re-import elsewhere.
 */
class RoleTemplateExportService
{
    public const FORMAT = 'ecos.role-template';

    public const FORMAT_VERSION = 1;

    /** @return array<string,mixed> */
    public function toArray(RoleTemplate $template): array
    {
        return [
            'format' => self::FORMAT,
            'format_version' => self::FORMAT_VERSION,
            'exported_at' => now()->toIso8601String(),
            'template' => [
                'key' => $template->key,
                'name' => $template->name,
                'description' => $template->description,
                'category' => $template->category,
                'version' => $template->version,
                'is_composable' => $template->is_composable,
                'definition' => $template->definition,
            ],
        ];
    }

    public function toJson(RoleTemplate $template, int $flags = JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES): string
    {
        return (string) json_encode($this->toArray($template), $flags | JSON_THROW_ON_ERROR);
    }
}
