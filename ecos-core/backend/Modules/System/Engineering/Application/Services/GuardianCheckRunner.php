<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Modules\System\Engineering\Domain\Enums\GuardianCheckCategory;
use Modules\System\Engineering\Domain\Enums\ValidationStepStatus;
use Modules\System\Engineering\Domain\Enums\ValidatorType;
use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\GuardianPolicy;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\RepairPatch;

/**
 * TASK-ENG-V2-003 — Autonomous Engineering Guardian.
 *
 * Executes the Guardian check matrix for a run. Reuses the Self-Healing
 * Pipeline static validators (TASK-ENG-V2-002) by wrapping the commit
 * diff in an EPHEMERAL RepairPatch instance (never persisted). No
 * validator logic is duplicated here.
 */
class GuardianCheckRunner
{
    private const DETAILS_MAX_LENGTH = 32000;

    private const EVIDENCE_MAX_ITEMS = 20;

    public function __construct(
        private readonly PatchSecurityValidator $securityValidator,
        private readonly AdrComplianceValidator $adrValidator,
        private readonly PatchSafetyRuleEngine $safetyEngine,
        private readonly CommandValidatorRunner $commandRunner,
    ) {}

    /**
     * Run all policy-enabled checks against the run's commit diff.
     *
     * @return Collection<int, GuardianCheck>
     */
    public function runChecks(GuardianRun $run, GuardianPolicy $policy, string $diffContent): Collection
    {
        $files = $run->changed_files ?? [];

        // Ephemeral wrapper so the static validators can consume the
        // commit diff exactly like a repair patch. NOT saved.
        $patch = new RepairPatch([
            'patch_content'  => $diffContent,
            'patch_format'   => 'diff',
            'files_affected' => $files,
            'lines_added'    => 0,
            'lines_removed'  => 0,
            'company_id'     => $run->company_id,
        ]);

        $enabled = $policy->enabled_checks; // null = all checks enabled
        $checks  = [];

        // --- Static checks (reused Self-Healing validators) ---

        if ($this->isCheckEnabled($enabled, 'security_scan')) {
            $startedAt = microtime(true);

            $checks[] = $this->recordStaticCheck(
                $run,
                $policy,
                'security_scan',
                GuardianCheckCategory::Security,
                $this->securityValidator->analyze($patch),
                $startedAt,
            );
        }

        if ($this->isCheckEnabled($enabled, 'adr_compliance')) {
            $startedAt = microtime(true);

            $checks[] = $this->recordStaticCheck(
                $run,
                $policy,
                'adr_compliance',
                GuardianCheckCategory::AdrCompliance,
                $this->adrValidator->analyze($patch),
                $startedAt,
            );
        }

        if ($this->isCheckEnabled($enabled, 'safety_rules')) {
            $startedAt = microtime(true);

            $checks[] = $this->recordStaticCheck(
                $run,
                $policy,
                'safety_rules',
                GuardianCheckCategory::Safety,
                $this->safetyEngine->evaluate($patch, $run->company_id),
                $startedAt,
            );
        }

        // --- Toolchain checks (OS-process validators) ---

        foreach ((array) config('engineering.guardian.toolchain_checks', []) as $checkName) {
            if (! $this->isCheckEnabled($enabled, $checkName)) {
                continue;
            }

            $type = ValidatorType::tryFrom($checkName);

            if ($type === null) {
                continue;
            }

            if (! $type->appliesTo($files)) {
                // Structurally not applicable — the only legitimate Skipped.
                $checks[] = GuardianCheck::create([
                    'run_id'      => $run->id,
                    'company_id'  => $run->company_id,
                    'check_name'  => $checkName,
                    'category'    => GuardianCheckCategory::Toolchain->value,
                    'status'      => ValidationStepStatus::Skipped,
                    'is_blocking' => false,
                    'details'     => 'Not applicable to changed file set',
                    'evidence'    => [],
                    'duration_ms' => 0,
                ]);

                continue;
            }

            $result = $this->commandRunner->run($type, $files);
            $passed = (bool) ($result['passed'] ?? false);

            $details = trim(implode("\n", array_filter([
                $result['error'] ?? null,
                $result['error_output'] ?? '',
                $result['output'] ?? '',
            ], static fn ($part): bool => $part !== null && $part !== '')));

            if ($details === '') {
                $details = $passed ? 'Passed with no output' : 'Failed with no output';
            }

            $checks[] = GuardianCheck::create([
                'run_id'      => $run->id,
                'company_id'  => $run->company_id,
                'check_name'  => $checkName,
                'category'    => GuardianCheckCategory::Toolchain->value,
                'status'      => $passed ? ValidationStepStatus::Passed : ValidationStepStatus::Failed,
                'is_blocking' => $policy->blocksCategory(GuardianCheckCategory::Toolchain->value),
                'details'     => $this->truncate($details),
                'evidence'    => [],
                'duration_ms' => (int) ($result['duration_ms'] ?? 0),
            ]);
        }

        $failedCount = count(array_filter(
            $checks,
            static fn (GuardianCheck $check): bool => $check->status->isFailure(),
        ));

        $run->update([
            'total_checks'        => count($checks),
            'failed_checks_count' => $failedCount,
        ]);

        return collect($checks);
    }

    /**
     * Persist the result of a static (violation-list) check.
     *
     * @param  array<int, array<string, mixed>>  $violations  Empty array = pass.
     */
    private function recordStaticCheck(
        GuardianRun $run,
        GuardianPolicy $policy,
        string $checkName,
        GuardianCheckCategory $category,
        array $violations,
        float $startedAt,
    ): GuardianCheck {
        return GuardianCheck::create([
            'run_id'      => $run->id,
            'company_id'  => $run->company_id,
            'check_name'  => $checkName,
            'category'    => $category->value,
            'status'      => empty($violations) ? ValidationStepStatus::Passed : ValidationStepStatus::Failed,
            'is_blocking' => $policy->blocksCategory($category->value),
            'details'     => empty($violations)
                ? 'No violations'
                : $this->truncate((string) json_encode($violations, JSON_PRETTY_PRINT)),
            'evidence'    => array_slice($violations, 0, self::EVIDENCE_MAX_ITEMS),
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        ]);
    }

    private function isCheckEnabled(?array $enabled, string $name): bool
    {
        return $enabled === null || in_array($name, $enabled, true);
    }

    private function truncate(string $text): string
    {
        return mb_substr($text, 0, self::DETAILS_MAX_LENGTH);
    }
}
