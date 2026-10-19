<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Operations\Domain\Events\ReadinessValidated;

/**
 * Cross-module validation — is each authority in a state the operation can run
 * on right now?
 *
 * ┌─ VALIDATION READS, IT DOES NOT DECIDE ──────────────────────────────────┐
 * │ Every check is derived from a figure the owning module already produced: │
 * │ Fleet's readiness (via Phase 5's fleet dashboard, which consumes Fleet),  │
 * │ Network's ledger (via CapacityMonitoringService), Dispatch's monitoring,  │
 * │ Operations' exception registry. This class computes NO readiness and NO   │
 * │ capacity of its own — it interprets what it reads into pass/degraded/fail │
 * │ and states the reason in words.                                          │
 * │                                                                          │
 * │ Read-only. Nothing here writes, and the "report" can be regenerated from │
 * │ scratch on every request because nothing is stored (read-model only).    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CrossModuleValidationService
{
    public const READY = 'ready';

    public const DEGRADED = 'degraded';

    public const NOT_READY = 'not_ready';

    /** Above this share of unfit vehicles, the fleet is degraded, not ready. */
    private const UNFIT_WARN_RATIO = 0.5;

    /** Above this average slot utilisation, capacity is degraded. */
    private const CAPACITY_WARN = 0.85;

    public function __construct(
        private readonly OperationalDashboardService $dashboards,
        private readonly CapacityMonitoringService $capacity,
        private readonly DispatchMonitoringService $dispatch,
        private readonly ExceptionQueryService $exceptions,
    ) {}

    /**
     * The unified validation report across every authority.
     *
     * @return array<string, mixed>
     */
    public function report(?string $companyId = null): array
    {
        $modules = [
            $this->validateFleet($companyId),
            $this->validateDrivers($companyId),
            $this->validateCapacity($companyId),
            $this->validateDispatch($companyId),
            $this->validateOperations($companyId),
        ];

        $report = [
            'generated_at' => Carbon::now()->toIso8601String(),
            'overall_status' => $this->rollUp(array_column($modules, 'status')),
            'modules' => $modules,
            'ready_count' => count(array_filter($modules, static fn ($m) => $m['status'] === self::READY)),
            'degraded_count' => count(array_filter($modules, static fn ($m) => $m['status'] === self::DEGRADED)),
            'not_ready_count' => count(array_filter($modules, static fn ($m) => $m['status'] === self::NOT_READY)),
        ];

        // Notification only — the validation already ran; this announces its
        // verdict for Observability / AI / Automation. Carries scalars, so a
        // consumer reacts without this class touching the database.
        ReadinessValidated::dispatch(
            $report['overall_status'],
            $report['ready_count'],
            $report['degraded_count'],
            $report['not_ready_count'],
            $companyId,
            $report['generated_at'],
        );

        return $report;
    }

    /** One module by key, or null if the key is unknown. */
    public function validate(string $module, ?string $companyId = null): ?array
    {
        return match ($module) {
            'fleet' => $this->validateFleet($companyId),
            'drivers' => $this->validateDrivers($companyId),
            'capacity' => $this->validateCapacity($companyId),
            'dispatch' => $this->validateDispatch($companyId),
            'operations' => $this->validateOperations($companyId),
            default => null,
        };
    }

    // ── Per-module validation ─────────────────────────────────────────────────

    /** @return array<string, mixed> */
    public function validateFleet(?string $companyId = null): array
    {
        // Fleet's own verdict, read through Phase 5's dashboard — never recomputed.
        $d = $this->dashboards->fleetUtilisation($companyId);

        $checks = [
            $this->check('has_vehicles', $d['total_vehicles'] > 0, 'blocking', "{$d['total_vehicles']} vehicle(s) registered."),
            $this->check('has_assignable', $d['assignable'] > 0, 'blocking', "{$d['assignable']} assignable now."),
            $this->check(
                'unfit_under_threshold',
                $d['total_vehicles'] === 0 || ($d['unfit'] / max(1, $d['total_vehicles'])) < self::UNFIT_WARN_RATIO,
                'advisory',
                "{$d['unfit']} unfit of {$d['total_vehicles']}.",
            ),
        ];

        return $this->module('fleet', 'Fleet', $checks, $this->fleetReasons($d));
    }

    /** @return array<string, mixed> */
    public function validateDrivers(?string $companyId = null): array
    {
        $d = $this->dashboards->driverUtilisation($companyId);

        $checks = [
            $this->check('has_drivers', $d['total_drivers'] > 0, 'blocking', "{$d['total_drivers']} driver(s) registered."),
            $this->check('has_available', $d['available'] > 0, 'blocking', "{$d['available']} available now."),
        ];

        $reasons = [];
        if ($d['total_drivers'] === 0) {
            $reasons[] = 'No drivers are registered, so no trip can be crewed.';
        } elseif ($d['available'] === 0) {
            $reasons[] = 'Every driver is unavailable; nothing can go out until one is free.';
        }

        return $this->module('drivers', 'Drivers', $checks, $reasons);
    }

    /** @return array<string, mixed> */
    public function validateCapacity(?string $companyId = null): array
    {
        // Network's ledger, reported not recomputed.
        $c = $this->capacity->overview($companyId);

        $hasPlan = $c['slot_count'] > 0;
        $allExhausted = $hasPlan && $c['exhausted'] >= $c['slot_count'];

        $checks = [
            $this->check('has_capacity_plan', $hasPlan, 'advisory', "{$c['slot_count']} slot(s) planned today."),
            $this->check('not_fully_exhausted', ! $allExhausted, 'blocking', "{$c['exhausted']} exhausted of {$c['slot_count']}."),
            $this->check(
                'utilisation_under_warn',
                $c['avg_utilisation'] === null || $c['avg_utilisation'] < self::CAPACITY_WARN,
                'advisory',
                $c['avg_utilisation'] === null ? 'No utilisation data.' : round($c['avg_utilisation'] * 100).'% average.',
            ),
        ];

        $reasons = [];
        if (! $hasPlan) {
            $reasons[] = 'No capacity plan exists for today.';
        } elseif ($allExhausted) {
            $reasons[] = 'Every capacity slot is exhausted; the network cannot take more.';
        }

        return $this->module('capacity', 'Capacity', $checks, $reasons);
    }

    /** @return array<string, mixed> */
    public function validateDispatch(?string $companyId = null): array
    {
        // Phase 3's own numbers.
        $health = $this->dispatch->assignmentHealth($companyId);
        $queue = $this->dispatch->queueStatistics($companyId);

        $checks = [
            $this->check('no_blocking_conflicts', $health['blocking_conflicts'] === 0, 'blocking', "{$health['blocking_conflicts']} blocking conflict(s)."),
            $this->check('queue_not_stuck', $queue['stuck'] === 0, 'advisory', "{$queue['stuck']} stuck item(s)."),
            $this->check('reviews_clear', $health['pending_reviews'] === 0, 'advisory', "{$health['pending_reviews']} awaiting review."),
        ];

        $reasons = [];
        if ($health['blocking_conflicts'] > 0) {
            $reasons[] = "{$health['blocking_conflicts']} blocking conflict(s) are stopping releases.";
        }
        if ($queue['stuck'] > 0) {
            $reasons[] = "{$queue['stuck']} queue item(s) keep failing and need a human.";
        }

        return $this->module('dispatch', 'Dispatch', $checks, $reasons);
    }

    /** @return array<string, mixed> */
    public function validateOperations(?string $companyId = null): array
    {
        $summary = $this->exceptions->summary($companyId);

        $checks = [
            $this->check('no_critical_exceptions', $summary['critical'] === 0, 'blocking', "{$summary['critical']} critical exception(s)."),
            $this->check('nothing_overdue', $summary['overdue_for_escalation'] === 0, 'advisory', "{$summary['overdue_for_escalation']} overdue for escalation."),
            $this->check('attention_manageable', $summary['needs_attention'] === 0, 'advisory', "{$summary['needs_attention']} need attention."),
        ];

        $reasons = [];
        if ($summary['critical'] > 0) {
            $reasons[] = "{$summary['critical']} critical exception(s) are open.";
        }
        if ($summary['overdue_for_escalation'] > 0) {
            $reasons[] = "{$summary['overdue_for_escalation']} exception(s) have waited past their escalation threshold.";
        }

        return $this->module('operations', 'Operations', $checks, $reasons);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * A module's status is the worst of its checks: a failed blocking check is
     * not_ready; a failed advisory check is degraded; all passing is ready.
     *
     * @param  list<array<string, mixed>>  $checks
     * @param  list<string>  $reasons
     * @return array<string, mixed>
     */
    private function module(string $key, string $label, array $checks, array $reasons): array
    {
        $status = self::READY;

        foreach ($checks as $check) {
            if ($check['passed']) {
                continue;
            }

            if ($check['severity'] === 'blocking') {
                $status = self::NOT_READY;
                break;
            }

            $status = self::DEGRADED;
        }

        return [
            'module' => $key,
            'label' => $label,
            'status' => $status,
            'checks' => $checks,
            'reasons' => $reasons,
            'passed_checks' => count(array_filter($checks, static fn ($c) => $c['passed'])),
            'total_checks' => count($checks),
        ];
    }

    /** @return array<string, mixed> */
    private function check(string $name, bool $passed, string $severity, string $detail): array
    {
        return ['name' => $name, 'passed' => $passed, 'severity' => $severity, 'detail' => $detail];
    }

    /**
     * Worst status wins across modules — one not-ready module makes the whole
     * operation not ready, whatever the others say.
     *
     * @param  list<string>  $statuses
     */
    private function rollUp(array $statuses): string
    {
        if (in_array(self::NOT_READY, $statuses, true)) {
            return self::NOT_READY;
        }

        if (in_array(self::DEGRADED, $statuses, true)) {
            return self::DEGRADED;
        }

        return self::READY;
    }

    /**
     * @param  array<string, mixed>  $d
     * @return list<string>
     */
    private function fleetReasons(array $d): array
    {
        $reasons = [];

        if ($d['total_vehicles'] === 0) {
            $reasons[] = 'No vehicles are registered.';
        } elseif ($d['assignable'] === 0) {
            $reasons[] = 'No vehicle is assignable right now — Fleet reports every one unfit or out of service.';
        }

        if ($d['total_vehicles'] > 0 && ($d['unfit'] / max(1, $d['total_vehicles'])) >= self::UNFIT_WARN_RATIO) {
            $reasons[] = "Over half the fleet is unfit ({$d['unfit']} of {$d['total_vehicles']}).";
        }

        return $reasons;
    }
}
