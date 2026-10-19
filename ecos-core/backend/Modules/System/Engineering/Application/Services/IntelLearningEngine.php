<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\GuardianCheck;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Modules\System\Engineering\Domain\Models\ValidationStep;

/**
 * Learning Engine (TASK-ENG-V2-004).
 *
 * Learns from successful AND failed AI repairs, validation failures, and
 * guardian check failures by recomputing knowledge-base aggregates from
 * the full source history. Recompute-not-increment makes every learning
 * run reproducible: the knowledge base after learn() is a pure function
 * of the underlying V2-001/002/003 records.
 *
 * READ-ONLY toward every other module: the only writes go to the
 * platform's own engineering_intel_knowledge table.
 */
class IntelLearningEngine
{
    public function __construct(
        private readonly IntelKnowledgeBase $knowledgeBase,
    ) {}

    /**
     * Full learning pass. Returns counts of knowledge entries touched.
     *
     * @return array{repair: int, validation: int, guardian: int}
     */
    public function learn(string $companyId): array
    {
        return [
            'repair'     => $this->learnFromRepairs($companyId),
            'validation' => $this->learnFromValidations($companyId),
            'guardian'   => $this->learnFromGuardian($companyId),
        ];
    }

    /**
     * One knowledge entry per (failure_type, root_cause) signature across
     * terminal repair sessions; completed sessions count as successes,
     * failed/timeout as failures.
     */
    private function learnFromRepairs(string $companyId): int
    {
        $rows = RepairSession::query()
            ->toBase()
            ->selectRaw(
                "failure_type, COALESCE(root_cause_category, 'unknown') AS root_cause, "
                . "COUNT(*) AS occurrences, "
                . "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successes, "
                . "SUM(CASE WHEN status IN ('failed', 'timeout') THEN 1 ELSE 0 END) AS failures, "
                . 'MAX(created_at) AS last_seen'
            )
            ->where('company_id', $companyId)
            ->whereIn('status', ['completed', 'failed', 'timeout', 'cancelled'])
            ->groupBy('failure_type')
            ->groupByRaw("COALESCE(root_cause_category, 'unknown')")
            ->get();

        foreach ($rows as $row) {
            $approach = $this->dominantApproach($companyId, (string) $row->failure_type, (string) $row->root_cause);

            $this->knowledgeBase->upsert($companyId, 'repair', (string) $row->failure_type, (string) $row->root_cause, [
                'occurrences'         => (int) $row->occurrences,
                'success_count'       => (int) $row->successes,
                'failure_count'       => (int) $row->failures,
                'resolution_approach' => $approach,
                'last_seen_at'        => $row->last_seen,
            ]);
        }

        return $rows->count();
    }

    /**
     * One knowledge entry per validator that has ever failed a step.
     */
    private function learnFromValidations(string $companyId): int
    {
        $rows = ValidationStep::query()
            ->toBase()
            ->selectRaw(
                'validator, COUNT(*) AS occurrences, '
                . "SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS successes, "
                . "SUM(CASE WHEN status IN ('failed', 'error') THEN 1 ELSE 0 END) AS failures, "
                . 'MAX(created_at) AS last_seen'
            )
            ->where('company_id', $companyId)
            ->whereIn('status', ['passed', 'failed', 'error'])
            ->groupBy('validator')
            ->get();

        $touched = 0;

        foreach ($rows as $row) {
            if ((int) $row->failures === 0) {
                continue;
            }

            $this->knowledgeBase->upsert($companyId, 'validation', 'validation_failure', (string) $row->validator, [
                'occurrences'   => (int) $row->occurrences,
                'success_count' => (int) $row->successes,
                'failure_count' => (int) $row->failures,
                'last_seen_at'  => $row->last_seen,
            ]);

            $touched++;
        }

        return $touched;
    }

    /**
     * One knowledge entry per guardian check that has ever failed —
     * recurring ADR violations surface here under category
     * adr_compliance.
     */
    private function learnFromGuardian(string $companyId): int
    {
        $rows = GuardianCheck::query()
            ->toBase()
            ->selectRaw(
                'category, check_name, COUNT(*) AS occurrences, '
                . "SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS successes, "
                . "SUM(CASE WHEN status IN ('failed', 'error') THEN 1 ELSE 0 END) AS failures, "
                . 'MAX(created_at) AS last_seen'
            )
            ->where('company_id', $companyId)
            ->whereIn('status', ['passed', 'failed', 'error'])
            ->groupBy('category', 'check_name')
            ->get();

        $touched = 0;

        foreach ($rows as $row) {
            if ((int) $row->failures === 0) {
                continue;
            }

            $this->knowledgeBase->upsert($companyId, 'guardian', (string) $row->category, (string) $row->check_name, [
                'occurrences'   => (int) $row->occurrences,
                'success_count' => (int) $row->successes,
                'failure_count' => (int) $row->failures,
                'last_seen_at'  => $row->last_seen,
            ]);

            $touched++;
        }

        return $touched;
    }

    /**
     * Most frequent repair approach among analyzed sessions of a
     * signature — deterministic tie-break by approach name.
     */
    private function dominantApproach(string $companyId, string $failureType, string $rootCause): ?string
    {
        $row = RepairSession::query()
            ->toBase()
            ->join(
                'engineering_repair_analyses',
                'engineering_repair_analyses.session_id',
                '=',
                'engineering_repair_sessions.id'
            )
            ->selectRaw('engineering_repair_analyses.repair_approach AS approach, COUNT(*) AS n')
            ->where('engineering_repair_sessions.company_id', $companyId)
            ->where('engineering_repair_sessions.failure_type', $failureType)
            ->when(
                $rootCause !== 'unknown',
                fn ($q) => $q->where('engineering_repair_sessions.root_cause_category', $rootCause),
                fn ($q) => $q->whereNull('engineering_repair_sessions.root_cause_category'),
            )
            ->groupBy('engineering_repair_analyses.repair_approach')
            ->orderByDesc('n')
            ->orderBy('approach')
            ->first();

        return $row?->approach;
    }
}
