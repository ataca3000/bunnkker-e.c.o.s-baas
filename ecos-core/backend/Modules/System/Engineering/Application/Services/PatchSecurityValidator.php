<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\RepairPatch;

/**
 * TASK-ENG-V2-002 — Self-Healing Pipeline.
 *
 * Static security analysis of AI-generated repair patches.
 * Scans ONLY the added lines of the patch for dangerous constructs.
 * Empty result array = pass.
 */
class PatchSecurityValidator
{
    public function analyze(RepairPatch $patch): array
    {
        $violations = [];
        $content    = (string) ($patch->patch_content ?? '');

        if ($content === '') {
            return $violations;
        }

        $addedLines    = $this->addedLines($content);
        $filesAffected = is_array($patch->files_affected) ? $patch->files_affected : [];

        foreach ($addedLines as $line) {
            $evidence = mb_substr(trim($line), 0, 200);

            // hardcoded_secret (critical)
            if (
                preg_match('/(api[_-]?key|secret|password)\s*(=>|=|:)\s*[\'"][^\'"]{8,}[\'"]/i', $line)
                || preg_match('/AKIA[0-9A-Z]{16}/', $line)
                || preg_match('/sk-[a-zA-Z0-9]{20,}/', $line)
            ) {
                $violations[] = [
                    'rule'     => 'hardcoded_secret',
                    'severity' => 'critical',
                    'message'  => 'Patch introduces what appears to be a hardcoded credential or API key.',
                    'evidence' => $evidence,
                ];
            }

            // dangerous_function (critical)
            if (preg_match('/(?<![a-zA-Z0-9_])(eval|exec|shell_exec|system|passthru|proc_open)\s*\(/i', $line)) {
                $violations[] = [
                    'rule'     => 'dangerous_function',
                    'severity' => 'critical',
                    'message'  => 'Patch introduces a dangerous PHP execution function (eval/exec/shell_exec/system/passthru/proc_open).',
                    'evidence' => $evidence,
                ];
            }

            // raw_sql_concatenation (high)
            $hasDbRaw    = stripos($line, 'DB::raw(') !== false;
            $hasWhereRaw = stripos($line, '->whereRaw(') !== false;

            if ($hasDbRaw || $hasWhereRaw) {
                $hasConcatenation = preg_match('/[\'"]\s*\.\s*|\.\s*[\'"]|\.\s*\$|\$\w+(\[[^\]]*\])?(->\w+)?\s*\./', $line) === 1;
                $hasInterpolation = preg_match('/"[^"]*\{?\$\w+/', $line) === 1;

                if ($hasConcatenation || $hasInterpolation) {
                    $violations[] = [
                        'rule'     => 'raw_sql_concatenation',
                        'severity' => 'high',
                        'message'  => 'Raw SQL built via string concatenation or interpolation — SQL injection risk. Use bindings instead.',
                        'evidence' => $evidence,
                    ];
                }
            }

            // auth_bypass (critical)
            if (
                stripos($line, 'withoutMiddleware') !== false
                || stripos($line, "->except(['auth'") !== false
                || (stripos($line, 'Gate::before') !== false && preg_match('/(=>|return)\s*true/i', $line))
            ) {
                $violations[] = [
                    'rule'     => 'auth_bypass',
                    'severity' => 'critical',
                    'message'  => 'Patch weakens authentication/authorization (middleware removal or unconditional Gate::before).',
                    'evidence' => $evidence,
                ];
            }

            // debug_left_in (medium)
            if (
                preg_match('/(?<![a-zA-Z0-9_.$])(dd|dump|var_dump)\s*\(/', $line)
                || stripos($line, 'console.log(') !== false
            ) {
                $violations[] = [
                    'rule'     => 'debug_left_in',
                    'severity' => 'medium',
                    'message'  => 'Debug statement left in patched code (dd/dump/var_dump/console.log).',
                    'evidence' => $evidence,
                ];
            }

            // env_in_code (medium) — env() outside config context
            if (
                preg_match('/(?<![a-zA-Z0-9_$>])env\s*\(/i', $line)
                && $this->touchesPhpOutsideConfig($filesAffected)
            ) {
                $violations[] = [
                    'rule'     => 'env_in_code',
                    'severity' => 'medium',
                    'message'  => 'env() called outside a config file — use config() so values survive config caching.',
                    'evidence' => $evidence,
                ];
            }

            // mass_assignment_unguard (high)
            if (
                stripos($line, '::unguard(') !== false
                || preg_match('/\$guarded\s*=\s*\[\s*\]/', $line)
            ) {
                $violations[] = [
                    'rule'     => 'mass_assignment_unguard',
                    'severity' => 'high',
                    'message'  => 'Patch disables mass-assignment protection (Model::unguard() or empty $guarded).',
                    'evidence' => $evidence,
                ];
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

        // Non-diff content: no added markers found, scan everything.
        if ($added === []) {
            return $lines;
        }

        return $added;
    }

    /**
     * env() is legitimate inside config/ files. Flag only when the patch
     * touches a PHP file outside a config directory (or file paths are unknown).
     *
     * @param array<int, string> $filesAffected
     */
    private function touchesPhpOutsideConfig(array $filesAffected): bool
    {
        if ($filesAffected === []) {
            return true; // Unknown paths — be conservative.
        }

        foreach ($filesAffected as $path) {
            $normalized = str_replace('\\', '/', strtolower((string) $path));

            if (! str_ends_with($normalized, '.php')) {
                continue;
            }

            if (! str_starts_with($normalized, 'config/') && ! str_contains($normalized, '/config/')) {
                return true;
            }
        }

        return false;
    }
}
