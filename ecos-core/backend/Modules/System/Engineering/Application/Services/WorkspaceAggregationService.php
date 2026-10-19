<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Models\EngineeringRelease;
use Modules\System\Engineering\Domain\Models\GuardianDecisionLog;
use Modules\System\Engineering\Domain\Models\GuardianRun;
use Modules\System\Engineering\Domain\Models\IntelInsight;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\RepairHistory;
use Modules\System\Engineering\Domain\Models\RepairSession;
use Modules\System\Engineering\Domain\Models\ValidationHistory;

/**
 * Enterprise Engineering Workspace aggregation layer (TASK-ENG-V2-005).
 *
 * Pure composition: every figure comes from an existing V2-001/002/003/004
 * or ENG-009 service, or is a read-only projection of their tables. The
 * workspace performs NO engineering decisions, executes nothing, and owns
 * no business logic — visualization support only.
 */
class WorkspaceAggregationService
{
    public function __construct(
        private readonly RepairEngine $repairEngine,
        private readonly GuardianEngine $guardianEngine,
        private readonly AIReviewEngine $supervisorEngine,
        private readonly IntelAnalyticsEngine $intelAnalytics,
        private readonly IntelDebtAnalyzer $intelDebt,
        private readonly IntelInsightsEngine $intelInsights,
        private readonly IntelPredictionEngine $intelPredictions,
        private readonly IntelConfidenceScorer $confidenceScorer,
        private readonly ReleaseValidationService $releaseValidation,
    ) {}

    /**
     * Executive dashboard: one composed payload for the top-level view.
     *
     * @return array<string, mixed>
     */
    public function executive(string $companyId): array
    {
        $overview   = $this->intelAnalytics->overview($companyId, 30);
        $debt       = $this->intelDebt->analyze($companyId);
        $supervisor = $this->supervisorEngine->getDashboard($companyId);

        return [
            'health'       => [
                'repair_success_rate'    => $overview['repairs']['success_rate'],
                'validation_accept_rate' => $overview['validations']['accept_rate'],
                'guardian_allow_rate'    => $overview['guardian']['allow_rate'],
                'supervisor_score'       => $supervisor['overall_score'] ?? null,
                'debt_score'             => $debt['debt_score'],
                'debt_level'             => $debt['debt_level'],
            ],
            'repairs'      => $this->repairEngine->getDashboard($companyId),
            'guardian'     => $this->guardianEngine->dashboard($companyId),
            'validations'  => $overview['validations'],
            'releases'     => $this->releaseReadiness($companyId, 5),
            'insights'     => $this->intelInsights->list($companyId)->take(5)->values(),
            'debt'         => $debt,
        ];
    }

    /**
     * Live monitor: everything currently in flight plus the freshest
     * timeline slice. Designed for short-interval polling.
     *
     * @return array<string, mixed>
     */
    public function live(string $companyId): array
    {
        return [
            'active_repairs'      => RepairSession::query()
                ->where('company_id', $companyId)
                ->whereNotIn('status', ['completed', 'failed', 'cancelled', 'timeout'])
                ->orderByDesc('created_at')
                ->limit(20)
                ->get(),
            'running_validations' => PatchValidation::query()
                ->where('company_id', $companyId)
                ->whereIn('status', ['pending', 'running'])
                ->orderByDesc('created_at')
                ->limit(20)
                ->get(),
            'active_guardian_runs' => GuardianRun::query()
                ->where('company_id', $companyId)
                ->whereNotIn('status', ['passed', 'failed', 'error', 'cancelled'])
                ->orderByDesc('created_at')
                ->limit(20)
                ->get(),
            'recent_events'        => $this->timeline($companyId, null, 15)['events'],
        ];
    }

    /**
     * Unified engineering timeline: repair events, validation events, and
     * guardian decisions merged into one reverse-chronological stream.
     *
     * @return array{events: array<int, array<string, mixed>>, has_more: bool}
     */
    public function timeline(string $companyId, ?string $type = null, int $limit = 50): array
    {
        $limit = max(1, min(200, $limit));

        $events = collect();

        if ($type === null || $type === 'repair') {
            $events = $events->merge(
                RepairHistory::query()
                    ->where('company_id', $companyId)
                    ->orderByDesc('occurred_at')
                    ->limit($limit)
                    ->get()
                    ->map(static fn (RepairHistory $event): array => [
                        'source'      => 'repair',
                        'event_type'  => $event->event_type,
                        'subject_id'  => $event->session_id,
                        'data'        => $event->event_data,
                        'actor_id'    => $event->actor_id,
                        'occurred_at' => $event->occurred_at?->toIso8601String(),
                    ])
            );
        }

        if ($type === null || $type === 'validation') {
            $events = $events->merge(
                ValidationHistory::query()
                    ->where('company_id', $companyId)
                    ->orderByDesc('occurred_at')
                    ->limit($limit)
                    ->get()
                    ->map(static fn (ValidationHistory $event): array => [
                        'source'      => 'validation',
                        'event_type'  => $event->event_type,
                        'subject_id'  => $event->patch_id,
                        'data'        => $event->event_data,
                        'actor_id'    => $event->actor_id,
                        'occurred_at' => $event->occurred_at?->toIso8601String(),
                    ])
            );
        }

        if ($type === null || $type === 'guardian') {
            $events = $events->merge(
                GuardianDecisionLog::query()
                    ->where('company_id', $companyId)
                    ->orderByDesc('occurred_at')
                    ->limit($limit)
                    ->get()
                    ->map(static fn (GuardianDecisionLog $event): array => [
                        'source'      => 'guardian',
                        'event_type'  => 'decision.' . $event->decision->value,
                        'subject_id'  => $event->run_id,
                        'data'        => ['reason' => $event->reason],
                        'actor_id'    => $event->decided_by,
                        'occurred_at' => $event->occurred_at?->toIso8601String(),
                    ])
            );
        }

        $sorted = $events
            ->sortByDesc('occurred_at')
            ->values();

        return [
            'events'   => $sorted->take($limit)->values()->all(),
            'has_more' => $sorted->count() > $limit,
        ];
    }

    /**
     * Global search across engineering entities. Read-only, company
     * scoped, bounded per entity type.
     *
     * @return array<string, mixed>
     */
    public function search(string $companyId, string $query): array
    {
        $term = '%' . str_replace(['%', '_'], ['\\%', '\\_'], trim($query)) . '%';

        return [
            'repair_sessions' => RepairSession::query()
                ->where('company_id', $companyId)
                ->where(fn ($q) => $q
                    ->where('failure_summary', 'like', $term)
                    ->orWhere('root_cause_category', 'like', $term))
                ->orderByDesc('created_at')
                ->limit(10)
                ->get(['id', 'failure_type', 'failure_summary', 'status', 'created_at']),
            'guardian_runs'   => GuardianRun::query()
                ->where('company_id', $companyId)
                ->where(fn ($q) => $q
                    ->where('branch', 'like', $term)
                    ->orWhere('commit_ref', 'like', $term)
                    ->orWhere('decision_reason', 'like', $term))
                ->orderByDesc('created_at')
                ->limit(10)
                ->get(['id', 'branch', 'commit_ref', 'status', 'decision', 'created_at']),
            'releases'        => EngineeringRelease::query()
                ->where('company_id', $companyId)
                ->where(fn ($q) => $q
                    ->where('name', 'like', $term)
                    ->orWhere('version', 'like', $term))
                ->orderByDesc('created_at')
                ->limit(10)
                ->get(['id', 'name', 'version', 'status', 'created_at']),
            'insights'        => IntelInsight::query()
                ->where('company_id', $companyId)
                ->where('title', 'like', $term)
                ->orderByDesc('generated_at')
                ->limit(10)
                ->get(['id', 'insight_type', 'severity', 'title', 'generated_at']),
        ];
    }

    /**
     * Release readiness: recent releases with their persisted validation
     * posture and blocking issues, straight from ENG-008E services.
     *
     * @return array<int, array<string, mixed>>
     */
    public function releaseReadiness(string $companyId, int $limit = 10): array
    {
        return EngineeringRelease::query()
            ->where('company_id', $companyId)
            ->orderByDesc('created_at')
            ->limit(max(1, min(50, $limit)))
            ->get()
            ->map(function (EngineeringRelease $release): array {
                $validation = $this->releaseValidation->getResults($release);

                return [
                    'id'              => $release->id,
                    'name'            => $release->name,
                    'version'         => $release->version,
                    'status'          => $release->status,
                    'can_proceed'     => $validation['can_proceed'],
                    'blocking_issues' => $validation['blocking_issues'],
                    'passed_checks'   => $validation['passed'],
                    'failed_checks'   => $validation['failed'],
                    'total_score'     => $validation['total_score'],
                    'risk_count'      => $release->risks()->count(),
                    'created_at'      => $release->created_at?->toIso8601String(),
                ];
            })
            ->all();
    }

    /**
     * CSV export of a workspace dataset. Read-only projection; the caller
     * picks the dataset, the workspace never mutates anything.
     */
    public function exportCsv(string $companyId, string $dataset): string
    {
        [$header, $rows] = match ($dataset) {
            'repair_sessions' => [
                ['id', 'status', 'failure_type', 'root_cause', 'retry_count', 'created_at', 'completed_at'],
                RepairSession::query()->where('company_id', $companyId)->orderByDesc('created_at')->limit(1000)->get()
                    ->map(static fn (RepairSession $s): array => [
                        $s->id, $s->status->value ?? (string) $s->status, $s->failure_type->value ?? (string) $s->failure_type,
                        $s->root_cause_category, $s->retry_count, (string) $s->created_at, (string) $s->completed_at,
                    ])->all(),
            ],
            'validations' => [
                ['id', 'patch_id', 'attempt', 'status', 'verdict', 'failed_steps', 'failure_summary', 'created_at'],
                PatchValidation::query()->where('company_id', $companyId)->orderByDesc('created_at')->limit(1000)->get()
                    ->map(static fn (PatchValidation $v): array => [
                        $v->id, $v->patch_id, $v->attempt_number, $v->status->value ?? (string) $v->status,
                        $v->verdict?->value, $v->failed_steps, $v->failure_summary, (string) $v->created_at,
                    ])->all(),
            ],
            'guardian_runs' => [
                ['id', 'trigger_source', 'branch', 'status', 'decision', 'failed_checks', 'decision_reason', 'created_at'],
                GuardianRun::query()->where('company_id', $companyId)->orderByDesc('created_at')->limit(1000)->get()
                    ->map(static fn (GuardianRun $r): array => [
                        $r->id, $r->trigger_source, $r->branch, $r->status->value ?? (string) $r->status,
                        $r->decision?->value, $r->failed_checks_count, $r->decision_reason, (string) $r->created_at,
                    ])->all(),
            ],
            default => throw new \InvalidArgumentException("Unknown export dataset: {$dataset}"),
        };

        $lines = [implode(',', $header)];

        foreach ($rows as $row) {
            $lines[] = implode(',', array_map(
                static fn ($value): string => '"' . str_replace('"', '""', (string) ($value ?? '')) . '"',
                $row,
            ));
        }

        return implode("\n", $lines) . "\n";
    }
}
