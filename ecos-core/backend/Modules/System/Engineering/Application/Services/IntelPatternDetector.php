<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Modules\System\Engineering\Domain\Models\ValidationStep;

/**
 * Failure Pattern Detection (TASK-ENG-V2-004).
 *
 * Detects recurring engineering problems, recurring validation failures,
 * and recurring ADR violations directly from source history. Read-only;
 * a "pattern" requires at least MIN_RECURRENCE occurrences.
 */
class IntelPatternDetector
{
    private const MIN_RECURRENCE = 2;

    /**
     * @return array{
     *     recurring_problems: array<int, array<string, mixed>>,
     *     recurring_validation_failures: array<int, array<string, mixed>>,
     *     recurring_adr_violations: array<int, array<string, mixed>>
     * }
     */
    public function detect(string $companyId, int $days = 90): array
    {
        return [
            'recurring_problems'            => $this->recurringProblems($companyId, $days),
            'recurring_validation_failures' => $this->recurringValidationFailures($companyId, $days),
            'recurring_adr_violations'      => $this->recurringAdrViolations($companyId, $days),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recurringProblems(string $companyId, int $days): array
    {
        return RepairSession::query()
            ->toBase()
            ->selectRaw(
                "failure_type, COALESCE(root_cause_category, 'unknown') AS root_cause, "
                . 'COUNT(*) AS occurrences, MAX(created_at) AS last_seen'
            )
            ->where('company_id', $companyId)
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('failure_type')
            ->groupByRaw("COALESCE(root_cause_category, 'unknown')")
            ->havingRaw('COUNT(*) >= ?', [self::MIN_RECURRENCE])
            ->orderByDesc('occurrences')
            ->get()
            ->map(static fn ($row): array => [
                'failure_type' => $row->failure_type,
                'root_cause'   => $row->root_cause,
                'occurrences'  => (int) $row->occurrences,
                'last_seen'    => $row->last_seen,
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recurringValidationFailures(string $companyId, int $days): array
    {
        return ValidationStep::query()
            ->toBase()
            ->selectRaw('validator, COUNT(*) AS occurrences, MAX(created_at) AS last_seen')
            ->where('company_id', $companyId)
            ->whereIn('status', ['failed', 'error'])
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('validator')
            ->havingRaw('COUNT(*) >= ?', [self::MIN_RECURRENCE])
            ->orderByDesc('occurrences')
            ->get()
            ->map(static fn ($row): array => [
                'validator'   => $row->validator,
                'occurrences' => (int) $row->occurrences,
                'last_seen'   => $row->last_seen,
            ])
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recurringAdrViolations(string $companyId, int $days): array
    {
        return GuardianCheck::query()
            ->toBase()
            ->selectRaw('check_name, COUNT(*) AS occurrences, MAX(created_at) AS last_seen')
            ->where('company_id', $companyId)
            ->where('category', 'adr_compliance')
            ->whereIn('status', ['failed', 'error'])
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('check_name')
            ->havingRaw('COUNT(*) >= ?', [self::MIN_RECURRENCE])
            ->orderByDesc('occurrences')
            ->get()
            ->map(static fn ($row): array => [
                'check_name'  => $row->check_name,
                'occurrences' => (int) $row->occurrences,
                'last_seen'   => $row->last_seen,
            ])
            ->all();
    }
}
