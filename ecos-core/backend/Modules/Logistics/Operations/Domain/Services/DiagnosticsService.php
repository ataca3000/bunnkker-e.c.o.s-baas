<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Operations\Domain\Events\DiagnosticsGenerated;

/**
 * The Diagnostics Center — a system-health view assembled entirely from
 * projections the owning modules already expose.
 *
 * ┌─ PROJECTIONS, NEVER RECALCULATIONS ─────────────────────────────────────┐
 * │ Dependency health IS the cross-module validation, re-presented as the    │
 * │ upstream services this platform leans on. Queue, capacity, dispatch and  │
 * │ exception health are the Phase 3/4 monitoring outputs, unchanged. This   │
 * │ class adds a status verdict on top of numbers it did not compute.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class DiagnosticsService
{
    public function __construct(
        private readonly CrossModuleValidationService $validation,
        private readonly DispatchMonitoringService $dispatch,
        private readonly CapacityMonitoringService $capacity,
        private readonly ExceptionQueryService $exceptions,
        private readonly OperationalAlertService $alerts,
        private readonly OperationalHealthService $health,
    ) {}

    /**
     * The whole diagnostics picture in one call.
     *
     * @return array<string, mixed>
     */
    public function center(?string $companyId = null): array
    {
        // Compute the validation report ONCE. It is the source for both the
        // system and dependency sections, and it now emits a ReadinessValidated
        // event — calling it twice (as the standalone system/dependency methods
        // each do) would fire that event twice for a single diagnostics run.
        $report = $this->validation->report($companyId);
        $overview = $this->health->overview($companyId);

        $system = [
            'status' => $report['overall_status'],
            'is_quiet' => $overview['is_quiet'],
            'headline' => $overview['headline'],
            'modules_ready' => $report['ready_count'],
            'modules_degraded' => $report['degraded_count'],
            'modules_not_ready' => $report['not_ready_count'],
        ];

        $dependencies = [
            'status' => $report['overall_status'],
            'dependencies' => array_map(static fn (array $m) => [
                'name' => $m['module'],
                'label' => $m['label'],
                'status' => $m['status'],
                'reason' => $m['reasons'][0] ?? null,
            ], $report['modules']),
        ];

        $center = [
            'generated_at' => Carbon::now()->toIso8601String(),
            'system' => $system,
            'dependencies' => $dependencies,
            'queue' => $this->queueHealth($companyId),
            'capacity' => $this->capacityHealth($companyId),
            'dispatch' => $this->dispatchHealth($companyId),
            'exceptions' => $this->exceptionHealth($companyId),
        ];

        // Notification only.
        DiagnosticsGenerated::dispatch(
            $system['status'],
            $system['is_quiet'],
            $companyId,
            $center['generated_at'],
        );

        return $center;
    }

    /**
     * System Health — is the operation quiet, and what is the worst signal?
     *
     * @return array<string, mixed>
     */
    public function systemHealth(?string $companyId = null): array
    {
        $overview = $this->health->overview($companyId);
        $report = $this->validation->report($companyId);

        return [
            'status' => $report['overall_status'],
            'is_quiet' => $overview['is_quiet'],
            'headline' => $overview['headline'],
            'modules_ready' => $report['ready_count'],
            'modules_degraded' => $report['degraded_count'],
            'modules_not_ready' => $report['not_ready_count'],
        ];
    }

    /**
     * Dependency Health — the upstream authorities, each with its status. This
     * is the cross-module validation seen as a dependency graph.
     *
     * @return array<string, mixed>
     */
    public function dependencyHealth(?string $companyId = null): array
    {
        $report = $this->validation->report($companyId);

        return [
            'status' => $report['overall_status'],
            'dependencies' => array_map(static fn (array $m) => [
                'name' => $m['module'],
                'label' => $m['label'],
                'status' => $m['status'],
                'reason' => $m['reasons'][0] ?? null,
            ], $report['modules']),
        ];
    }

    /**
     * Queue Health — Phase 3's queue statistics, with a status verdict.
     *
     * @return array<string, mixed>
     */
    public function queueHealth(?string $companyId = null): array
    {
        $queue = $this->dispatch->queueStatistics($companyId);

        $status = $queue['stuck'] > 0
            ? CrossModuleValidationService::DEGRADED
            : CrossModuleValidationService::READY;

        return ['status' => $status, 'metrics' => $queue];
    }

    /**
     * Capacity Health — Network's ledger overview, with a status verdict.
     *
     * @return array<string, mixed>
     */
    public function capacityHealth(?string $companyId = null): array
    {
        $overview = $this->capacity->overview($companyId);

        $status = CrossModuleValidationService::READY;
        if ($overview['slot_count'] > 0 && $overview['exhausted'] >= $overview['slot_count']) {
            $status = CrossModuleValidationService::NOT_READY;
        } elseif ($overview['at_warn_threshold'] > 0) {
            $status = CrossModuleValidationService::DEGRADED;
        }

        return ['status' => $status, 'metrics' => $overview];
    }

    /**
     * Dispatch Health — Phase 3's assignment health, with a status verdict.
     *
     * @return array<string, mixed>
     */
    public function dispatchHealth(?string $companyId = null): array
    {
        $health = $this->dispatch->assignmentHealth($companyId);

        $status = $health['blocking_conflicts'] > 0
            ? CrossModuleValidationService::NOT_READY
            : ($health['pending_reviews'] > 0
                ? CrossModuleValidationService::DEGRADED
                : CrossModuleValidationService::READY);

        return ['status' => $status, 'metrics' => $health];
    }

    /**
     * Exception Health — the registry summary plus the live-alert counts.
     *
     * @return array<string, mixed>
     */
    public function exceptionHealth(?string $companyId = null): array
    {
        $summary = $this->exceptions->summary($companyId);
        $alerts = $this->alerts->summary($companyId);

        $status = $summary['critical'] > 0
            ? CrossModuleValidationService::NOT_READY
            : ($summary['needs_attention'] > 0
                ? CrossModuleValidationService::DEGRADED
                : CrossModuleValidationService::READY);

        return ['status' => $status, 'exceptions' => $summary, 'alerts' => $alerts];
    }
}
