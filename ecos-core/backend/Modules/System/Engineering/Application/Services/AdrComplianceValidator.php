<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\RepairPatch;

/**
 * TASK-ENG-V2-002 — Self-Healing Pipeline.
 *
 * Validates AI-generated repair patches against ECOS ADR standards:
 * idempotent migrations, casts() method convention, PostgreSQL compatibility,
 * cross-module ownership boundaries (ADR-027) and company isolation.
 * Empty result array = pass.
 */
class AdrComplianceValidator
{
    public function analyze(RepairPatch $patch): array
    {
        $violations = [];
        $content    = (string) ($patch->patch_content ?? '');

        if ($content === '') {
            return $violations;
        }

        $filesAffected = is_array($patch->files_affected) ? $patch->files_affected : [];
        $addedLines    = $this->addedLines($content);
        $addedContent  = implode("\n", $addedLines);

        // migration_guard_missing (high) — new migrations must be idempotent.
        if (
            $this->touchesMigrations($filesAffected)
            && str_contains($content, 'extends Migration')
            && ! str_contains($content, 'Schema::hasTable')
        ) {
            $violations[] = [
                'rule'     => 'migration_guard_missing',
                'severity' => 'high',
                'message'  => 'Migration lacks Schema::hasTable guard — ECOS migrations must be idempotent.',
                'evidence' => $this->firstMigrationPath($filesAffected),
            ];
        }

        foreach ($addedLines as $line) {
            $evidence = mb_substr(trim($line), 0, 200);

            // casts_property_used (medium) — ECOS uses casts() method, not property.
            if (str_contains($line, 'protected $casts')) {
                $violations[] = [
                    'rule'     => 'casts_property_used',
                    'severity' => 'medium',
                    'message'  => 'Model uses protected $casts property — ECOS convention is the casts() method.',
                    'evidence' => $evidence,
                ];
            }

            // postgres_incompatible (high) — per migration MySQL compat memory.
            if (str_contains($line, '->check(') || stripos($line, 'CONCURRENTLY') !== false) {
                $violations[] = [
                    'rule'     => 'postgres_incompatible',
                    'severity' => 'high',
                    'message'  => 'Blueprint ->check() / CONCURRENTLY are not portable — use DB::statement ALTER + Schema::table index instead.',
                    'evidence' => $evidence,
                ];
            }

            // cross_module_model_import (high) — ADR-027 ownership boundaries.
            if (preg_match('/use\s+Modules\\\\([A-Za-z]+)\\\\[A-Za-z\\\\]*Domain\\\\Models\\\\/', $line, $matches)) {
                $importedModule = $matches[1];
                $fileModules    = $this->affectedModules($filesAffected);

                if ($fileModules !== [] && ! in_array($importedModule, $fileModules, true)) {
                    $violations[] = [
                        'rule'     => 'cross_module_model_import',
                        'severity' => 'high',
                        'message'  => sprintf(
                            'Patch imports Domain\\Models from module "%s" into files owned by module(s) %s — cross-module model imports violate ownership boundaries (ADR-027).',
                            $importedModule,
                            implode(', ', $fileModules)
                        ),
                        'evidence' => $evidence,
                    ];
                }
            }
        }

        // company_isolation_missing (medium) — engineering_/config_ tables need company_id.
        if (preg_match_all('/Schema::create\(\s*[\'"]([A-Za-z0-9_]+)[\'"]/', $addedContent, $tableMatches)) {
            foreach ($tableMatches[1] as $tableName) {
                if (! str_starts_with($tableName, 'engineering_') && ! str_starts_with($tableName, 'config_')) {
                    continue;
                }

                if (
                    preg_match('/uuid\(\s*[\'"]id[\'"]\s*\)/', $addedContent)
                    && ! str_contains($addedContent, 'company_id')
                ) {
                    $violations[] = [
                        'rule'     => 'company_isolation_missing',
                        'severity' => 'medium',
                        'message'  => sprintf(
                            'New table "%s" is created without a company_id column — tenant isolation is expected for engineering_/config_ tables.',
                            $tableName
                        ),
                        'evidence' => $tableName,
                    ];
                }
            }
        }

        return $violations;
    }

    /**
     * Extract the added lines of a unified diff ("+" prefix, excluding "+++" headers).
     * Falls back to scanning all lines when the content is not diff-formatted.
     *
     * @return array<int, string>
     */
    private function addedLines(string $content): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $content) ?: [];
        $added = [];

        foreach ($lines as $line) {
            if (str_starts_with($line, '+') && ! str_starts_with($line, '+++')) {
                $added[] = substr($line, 1);
            }
        }

        if ($added === []) {
            return $lines;
        }

        return $added;
    }

    /**
     * @param array<int, string> $filesAffected
     */
    private function touchesMigrations(array $filesAffected): bool
    {
        foreach ($filesAffected as $path) {
            if (stripos(str_replace('\\', '/', (string) $path), '/Migrations/') !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int, string> $filesAffected
     */
    private function firstMigrationPath(array $filesAffected): ?string
    {
        foreach ($filesAffected as $path) {
            if (stripos(str_replace('\\', '/', (string) $path), '/Migrations/') !== false) {
                return (string) $path;
            }
        }

        return null;
    }

    /**
     * Extract the distinct top-level module segments ("Modules/<Name>/") of the affected files.
     *
     * @param array<int, string> $filesAffected
     * @return array<int, string>
     */
    private function affectedModules(array $filesAffected): array
    {
        $modules = [];

        foreach ($filesAffected as $path) {
            $normalized = str_replace('\\', '/', (string) $path);

            if (preg_match('#Modules/([A-Za-z]+)/#', $normalized, $matches)) {
                $modules[$matches[1]] = true;
            }
        }

        return array_keys($modules);
    }
}
