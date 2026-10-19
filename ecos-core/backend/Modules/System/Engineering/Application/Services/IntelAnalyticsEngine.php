<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\IntelSnapshot;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Modules\System\Engineering\Domain\Models\ValidationStep;

/**
 * Engineering Analytics + Success Metrics Engine (TASK-ENG-V2-004).
 *
 * Read-only aggregate views over V2-001/002/003 records. Every figure is
 * a deterministic aggregate of persisted rows; snapshot() freezes the
 * figures per period so historical values stay reproducible even after
 * new activity arrives.
 */
class IntelAnalyticsEngine
{
    /**
     * Success metrics overview for a trailing window.
     *
     * @return array<string, mixed>
     */
    public function overview(string $companyId, int $days = 30): array
    {
        $since = now()->subDays($days);

        $sessions      = RepairSession::query()->toBase()
            ->selectRaw(
                'COUNT(*) AS total, '
                . "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, "
                . "SUM(CASE WHEN status IN ('failed', 'timeout') THEN 1 ELSE 0 END) AS failed"
            )
            ->where('company_id', $companyId)
            ->where('created_at', '>=', $since)
            ->first();

        $validations = PatchValidation::query()->toBase()
            ->selectRaw(
                'COUNT(*) AS total, '
                . "SUM(CASE WHEN verdict = 'accepted' THEN 1 ELSE 0 END) AS accepted, "
                . "SUM(CASE WHEN verdict = 'rejected' THEN 1 ELSE 0 END) AS rejected"
            )
            ->where('company_id', $companyId)
            ->where('created_at', '>=', $since)
            ->first();

        $guardian = GuardianRun::query()->toBase()
            ->selectRaw(
                'COUNT(*) AS total, '
                . "SUM(CASE WHEN decision = 'allow' THEN 1 ELSE 0 END) AS allowed, "
                . "SUM(CASE WHEN decision = 'block' THEN 1 ELSE 0 END) AS blocked"
            )
            ->where('company_id', $companyId)
            ->where('created_at', '>=', $since)
            ->first();

        return [
            'window_days' => $days,
            'repairs'     => [
                'total'        => (int) $sessions->total,
                'completed'    => (int) $sessions->completed,
                'failed'       => (int) $sessions->failed,
                'success_rate' => $this->rate((int) $sessions->completed, (int) $sessions->completed + (int) $sessions->failed),
            ],
            'validations' => [
                'total'       => (int) $validations->total,
                'accepted'    => (int) $validations->accepted,
                'rejected'    => (int) $validations->rejected,
                'accept_rate' => $this->rate((int) $validations->accepted, (int) $validations->accepted + (int) $validations->rejected),
            ],
            'guardian'    => [
                'total'      => (int) $guardian->total,
                'allowed'    => (int) $guardian->allowed,
                'blocked'    => (int) $guardian->blocked,
                'allow_rate' => $this->rate((int) $guardian->allowed, (int) $guardian->allowed + (int) $guardian->blocked),
            ],
        ];
    }

    /**
     * Validator reliability: per-validator executed/passed/failed counts
     * and pass rate over a trailing window.
     *
     * @return array<int, array<string, mixed>>
     */
    public function validatorReliability(string $companyId, int $days = 90): array
    {
        return ValidationStep::query()
            ->toBase()
            ->selectRaw(
                'validator, COUNT(*) AS executed, '
                . "SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS passed, "
                . "SUM(CASE WHEN status IN ('failed', 'error') THEN 1 ELSE 0 END) AS failed, "
                . 'AVG(duration_ms) AS avg_duration_ms'
            )
            ->where('company_id', $companyId)
            ->whereIn('status', ['passed', 'failed', 'error'])
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('validator')
            ->orderBy('validator')
            ->get()
            ->map(fn ($row): array => [
                'validator'       => $row->validator,
                'executed'        => (int) $row->executed,
                'passed'          => (int) $row->passed,
                'failed'          => (int) $row->failed,
                'pass_rate'       => $this->rate((int) $row->passed, (int) $row->executed),
                'avg_duration_ms' => (int) round((float) ($row->avg_duration_ms ?? 0)),
            ])
            ->all();
    }

    /**
     * Freeze the current overview into a reproducible period snapshot.
     */
    public function snapshot(string $companyId, string $snapshotType, string $periodLabel): IntelSnapshot
    {
        $metrics = $this->overview($companyId, $snapshotType === 'weekly' ? 7 : 1);

        return IntelSnapshot::updateOrCreate(
            [
                'company_id'    => $companyId,
                'snapshot_type' => $snapshotType,
                'period_label'  => $periodLabel,
            ],
            [
                'metrics'     => $metrics,
                'recorded_at' => now(),
            ],
        );
    }

    /**
     * @return array<int, IntelSnapshot>
     */
    public function snapshots(string $companyId, string $snapshotType, int $limit = 30): array
    {
        return IntelSnapshot::query()
            ->where('company_id', $companyId)
            ->where('snapshot_type', $snapshotType)
            ->orderByDesc('period_label')
            ->limit($limit)
            ->get()
            ->all();
    }

    private function rate(int $numerator, int $denominator): float
    {
        if ($denominator === 0) {
            return 0.0;
        }

        return round(($numerator / $denominator) * 100.0, 2);
    }
}
