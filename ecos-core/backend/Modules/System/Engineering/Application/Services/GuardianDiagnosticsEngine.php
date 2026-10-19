<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Illuminate\Support\Collection;
use Modules\System\Engineering\Domain\Enums\ValidationStepStatus;
use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\GuardianRun;

/**
 * Builds structured, human-actionable diagnostics for a Guardian run
 * (TASK-ENG-V2-003 Autonomous Engineering Guardian).
 *
 * The engine turns raw check rows into a headline, per-category rollup,
 * failure remediation guidance and concrete next steps. It performs no
 * persistence: GuardianReportService consumes its output.
 */
class GuardianDiagnosticsEngine
{
    public function buildDiagnostics(GuardianRun $run): array
    {
        $run->loadMissing('checks');

        /** @var Collection<int, GuardianCheck> $checks */
        $checks = $run->checks;

        $total = $checks->count();

        $failedChecks = $checks->filter(
            static fn (GuardianCheck $check): bool => (bool) $check->status?->isFailure()
        );

        $failedCount = $failedChecks->count();

        if ($failedCount === 0) {
            $headline = sprintf('All %d checks passed.', $total);
        } else {
            $failedCategories = $failedChecks
                ->map(static fn (GuardianCheck $check): string => $check->category?->value ?? 'unknown')
                ->unique()
                ->values()
                ->implode(', ');

            $headline = sprintf(
                '%d of %d checks failed (categories: %s).',
                $failedCount,
                $total,
                $failedCategories
            );
        }

        $byCategory = $checks
            ->groupBy(static fn (GuardianCheck $check): string => $check->category?->value ?? 'unknown')
            ->map(static fn (Collection $group): array => [
                'total'   => $group->count(),
                'passed'  => $group->filter(
                    static fn (GuardianCheck $check): bool => $check->status === ValidationStepStatus::Passed
                )->count(),
                'failed'  => $group->filter(
                    static fn (GuardianCheck $check): bool => (bool) $check->status?->isFailure()
                )->count(),
                'skipped' => $group->filter(
                    static fn (GuardianCheck $check): bool => $check->status === ValidationStepStatus::Skipped
                )->count(),
            ])
            ->all();

        $failures = $failedChecks
            ->map(function (GuardianCheck $check): array {
                $category = $check->category?->value ?? 'unknown';

                return [
                    'check_name'  => $check->check_name,
                    'category'    => $category,
                    'summary'     => mb_substr((string) ($check->details ?? ''), 0, 300),
                    'remediation' => $this->remediationFor((string) $check->check_name, $category),
                ];
            })
            ->values()
            ->all();

        return [
            'headline'    => $headline,
            'by_category' => $byCategory,
            'failures'    => $failures,
            'next_steps'  => $this->nextSteps($run),
        ];
    }

    private function remediationFor(string $checkName, string $category): string
    {
        return match ($category) {
            'security'       => 'Remove or replace the flagged pattern. Secrets belong in .env and config; dangerous functions and raw SQL concatenation are prohibited.',
            'adr_compliance' => 'Align the change with ECOS ADR standards: idempotent migrations with Schema::hasTable guards, casts() as a method, no cross-module Domain model imports.',
            'safety'         => 'The patch touches forbidden paths or exceeds size limits. Split the change or exclude protected files.',
            'toolchain'      => 'Run the failing tool locally ('.$checkName.') and fix reported issues before re-submitting.',
            default          => 'Review the check output and fix the reported issue before re-submitting.',
        };
    }

    /**
     * @return array<int, string>
     */
    private function nextSteps(GuardianRun $run): array
    {
        if ((int) $run->failed_checks_count === 0) {
            return ['Commit may proceed.'];
        }

        $steps = [];

        if ($run->repair_session_id !== null) {
            $steps[] = 'A repair session was opened automatically (id '.$run->repair_session_id.'). Generate/send the repair prompt from the AI Repair workspace.';
        } else {
            $steps[] = 'Fix the reported issues manually or open a repair session.';
        }

        $steps[] = 'Re-run the Guardian after repair; the gate only opens when every blocking check passes.';
        $steps[] = 'There is no override: a Block decision cannot be bypassed.';

        return $steps;
    }
}
