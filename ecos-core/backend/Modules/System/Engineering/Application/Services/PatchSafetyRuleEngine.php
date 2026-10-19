<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\RepairPatch;
use Modules\System\Engineering\Domain\Models\ValidationRule;
use Throwable;

/**
 * TASK-ENG-V2-002 — Self-Healing Pipeline.
 *
 * Evaluates repair patches against built-in safety limits plus
 * company-scoped custom rules stored in engineering_validation_rules.
 * Empty result array = pass.
 */
class PatchSafetyRuleEngine
{
    public function evaluate(RepairPatch $patch, string $companyId): array
    {
        $violations = [];

        $content       = (string) ($patch->patch_content ?? '');
        $filesAffected = is_array($patch->files_affected) ? $patch->files_affected : [];
        $linesAdded    = (int) ($patch->lines_added ?? 0);
        $linesRemoved  = (int) ($patch->lines_removed ?? 0);

        // ---------------------------------------------------------------
        // Built-in rules
        // ---------------------------------------------------------------

        // forbidden_path (critical)
        $forbiddenPaths = (array) config('engineering.self_healing.forbidden_paths', []);

        foreach ($filesAffected as $file) {
            $normalizedFile = str_replace('\\', '/', (string) $file);

            foreach ($forbiddenPaths as $forbidden) {
                $forbidden = str_replace('\\', '/', (string) $forbidden);

                if ($forbidden === '') {
                    continue;
                }

                $matched = str_ends_with($forbidden, '/')
                    ? (str_starts_with($normalizedFile, $forbidden) || str_contains($normalizedFile, $forbidden))
                    : str_starts_with($normalizedFile, $forbidden);

                if ($matched) {
                    $violations[] = [
                        'rule'     => 'forbidden_path',
                        'severity' => 'critical',
                        'message'  => sprintf('Patch touches forbidden path "%s" (matched rule "%s").', $normalizedFile, $forbidden),
                        'evidence' => $normalizedFile,
                    ];
                    break;
                }
            }
        }

        // max_files_exceeded (high)
        $maxFiles = (int) config('engineering.self_healing.limits.max_files_per_patch', 25);

        if (count($filesAffected) > $maxFiles) {
            $violations[] = [
                'rule'     => 'max_files_exceeded',
                'severity' => 'high',
                'message'  => sprintf('Patch touches %d files — limit is %d.', count($filesAffected), $maxFiles),
                'evidence' => (string) count($filesAffected),
            ];
        }

        // max_lines_exceeded (high)
        $maxLines   = (int) config('engineering.self_healing.limits.max_lines_per_patch', 2000);
        $totalLines = $linesAdded + $linesRemoved;

        if ($totalLines > $maxLines) {
            $violations[] = [
                'rule'     => 'max_lines_exceeded',
                'severity' => 'high',
                'message'  => sprintf('Patch changes %d lines (+%d/-%d) — limit is %d.', $totalLines, $linesAdded, $linesRemoved, $maxLines),
                'evidence' => (string) $totalLines,
            ];
        }

        // existing_migration_modified (critical)
        if (
            ($patch->patch_format ?? null) === 'diff'
            && preg_match('#^--- a/(.*/Migrations/[^\n]+)#mi', $content, $matches)
        ) {
            $violations[] = [
                'rule'     => 'existing_migration_modified',
                'severity' => 'critical',
                'message'  => 'Patch modifies an existing migration — migrations are append-only; add a new migration instead.',
                'evidence' => mb_substr(trim($matches[1]), 0, 200),
            ];
        }

        // ---------------------------------------------------------------
        // Custom company-scoped rules
        // ---------------------------------------------------------------

        $customRules = ValidationRule::query()
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->get();

        foreach ($customRules as $rule) {
            $ruleName = (string) ($rule->name ?: $rule->rule_type);
            $severity = (string) ($rule->severity ?: 'medium');

            switch ($rule->rule_type) {
                case 'forbidden_path':
                    if ($rule->pattern === null || $rule->pattern === '') {
                        break;
                    }

                    foreach ($filesAffected as $file) {
                        $normalizedFile = str_replace('\\', '/', (string) $file);

                        if (str_contains($normalizedFile, str_replace('\\', '/', (string) $rule->pattern))) {
                            $violations[] = [
                                'rule'     => $ruleName,
                                'severity' => $severity,
                                'message'  => sprintf('Patch touches path "%s" forbidden by custom rule "%s".', $normalizedFile, $ruleName),
                                'evidence' => $normalizedFile,
                            ];
                            break;
                        }
                    }
                    break;

                case 'forbidden_pattern':
                    if ($rule->pattern === null || $rule->pattern === '') {
                        break;
                    }

                    try {
                        $result = @preg_match((string) $rule->pattern, $content, $patternMatch);
                    } catch (Throwable) {
                        $result = false; // Bad regex in DB — skip the rule.
                    }

                    if ($result === 1) {
                        $violations[] = [
                            'rule'     => $ruleName,
                            'severity' => $severity,
                            'message'  => sprintf('Patch content matches forbidden pattern of custom rule "%s".', $ruleName),
                            'evidence' => isset($patternMatch[0]) ? mb_substr(trim((string) $patternMatch[0]), 0, 200) : null,
                        ];
                    }
                    break;

                case 'max_files':
                    if ($rule->threshold !== null && count($filesAffected) > (int) $rule->threshold) {
                        $violations[] = [
                            'rule'     => $ruleName,
                            'severity' => $severity,
                            'message'  => sprintf('Patch touches %d files — custom rule "%s" allows at most %d.', count($filesAffected), $ruleName, (int) $rule->threshold),
                            'evidence' => (string) count($filesAffected),
                        ];
                    }
                    break;

                case 'max_lines':
                    if ($rule->threshold !== null && $totalLines > (int) $rule->threshold) {
                        $violations[] = [
                            'rule'     => $ruleName,
                            'severity' => $severity,
                            'message'  => sprintf('Patch changes %d lines — custom rule "%s" allows at most %d.', $totalLines, $ruleName, (int) $rule->threshold),
                            'evidence' => (string) $totalLines,
                        ];
                    }
                    break;

                default:
                    // Unknown rule_type — ignore.
                    break;
            }
        }

        return $violations;
    }
}
