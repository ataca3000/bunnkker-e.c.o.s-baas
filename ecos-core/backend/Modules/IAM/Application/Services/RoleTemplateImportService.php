<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Contracts\RoleTemplateRepositoryInterface;
use Modules\IAM\Domain\Enums\RoleCategory;
use Modules\IAM\Domain\Exceptions\RoleTemplateImportException;
use Modules\IAM\Domain\Models\RoleTemplate;

/**
 * Imports a role template from a JSON payload (ADR-039).
 * ALWAYS produces a CUSTOM template — an import can never introduce a system template,
 * regardless of what the payload claims.
 */
class RoleTemplateImportService
{
    public function __construct(private readonly RoleTemplateRepositoryInterface $repository) {}

    /** @param array<string,mixed>|string $payload */
    public function import(array|string $payload, ?int $actorId = null): RoleTemplate
    {
        $data = is_string($payload) ? $this->decode($payload) : $payload;

        // Accept either the export envelope { format, template: {...} } or a bare template.
        $template = isset($data['template']) && is_array($data['template']) ? $data['template'] : $data;

        $key = trim((string) ($template['key'] ?? ''));
        $name = trim((string) ($template['name'] ?? ''));
        $category = (string) ($template['category'] ?? RoleCategory::CUSTOM->value);
        $definition = $template['definition'] ?? null;

        if ($key === '') {
            throw RoleTemplateImportException::because('missing "key"');
        }
        if ($name === '') {
            throw RoleTemplateImportException::because('missing "name"');
        }
        if (RoleCategory::tryFrom($category) === null) {
            throw RoleTemplateImportException::because("unknown category '{$category}'");
        }
        if (! is_array($definition)) {
            throw RoleTemplateImportException::because('missing or invalid "definition"');
        }

        return $this->repository->createCustom([
            'key' => $this->uniqueKey($key),
            'name' => $name,
            'description' => $template['description'] ?? null,
            'category' => $category,
            'is_composable' => (bool) ($template['is_composable'] ?? true),
            'definition' => $definition,
            'created_by' => $actorId,
        ]);
    }

    /** @return array<string,mixed> */
    private function decode(string $json): array
    {
        try {
            $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw RoleTemplateImportException::because('payload is not valid JSON');
        }

        if (! is_array($data)) {
            throw RoleTemplateImportException::because('payload must be a JSON object');
        }

        return $data;
    }

    private function uniqueKey(string $base): string
    {
        $candidate = $base;
        $n = 1;
        while ($this->repository->findByKey($candidate) !== null) {
            $candidate = "{$base}-imported".($n > 1 ? "-{$n}" : '');
            $n++;
        }

        return $candidate;
    }
}
