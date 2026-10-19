<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Modules\Logistics\Operations\Domain\Events\LogisticsHealthCalculated;

/**
 * Enterprise readiness — the health score, the module summary and the checklist,
 * all built ON TOP of CrossModuleValidationService.
 *
 * ┌─ SCORING OVER SIGNALS, NOT NEW SIGNALS ─────────────────────────────────┐
 * │ The Logistics Health Score is a weighted roll-up of the validation       │
 * │ statuses this service is HANDED. It invents no metric: a module that     │
 * │ CrossModuleValidationService calls ready scores full, degraded scores    │
 * │ half, not-ready scores zero. Change what "ready" means in one place and  │
 * │ the score follows.                                                       │
 * │                                                                          │
 * │ The weights say what the operation depends on most. They are the ONE     │
 * │ judgement this phase adds, and they are stated here in the open rather   │
 * │ than buried in a config table (read-model only — nothing is stored).     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ReadinessValidationService
{
    /*
     * ── Health-score weights ──────────────────────────────────────────────────
     *
     * Each authority contributes a fixed share of the 100-point score. These are
     * the ONE business judgement this phase adds, so they are named constants
     * with their rationale stated here rather than magic numbers inline. They
     * sum to 100 by design; changing one is a deliberate re-weighting of what
     * the operation is judged to depend on.
     */

    /**
     * Fleet — 25. A hard floor: without a roadworthy vehicle nothing moves at
     * all, so an unavailable fleet is one of the two heaviest drags on the score.
     */
    public const FLEET_WEIGHT = 25;

    /**
     * Drivers — 25. The other hard floor, weighted equal to Fleet: a vehicle
     * with no driver fields nothing, so crewing and vehicles fail the operation
     * symmetrically.
     */
    public const DRIVER_WEIGHT = 25;

    /**
     * Capacity — 20. Network gates how much can be committed, so it matters
     * heavily — but a shortfall usually degrades rather than halts (orders wait
     * for the next window), which is why it sits below the Fleet/Driver floor.
     */
    public const CAPACITY_WEIGHT = 20;

    /**
     * Dispatch — 20. Orchestration readiness: blocking conflicts stop releases,
     * but the underlying resources still exist and the block is resolvable, so
     * it carries the same weight as Capacity rather than the hard-floor weight.
     */
    public const DISPATCH_WEIGHT = 20;

    /**
     * Operations — 10. The exception backlog is a health signal, but an open
     * exception rarely halts execution on its own, so it carries the lightest
     * weight — enough to move the score, not enough to dominate it.
     */
    public const OPERATIONS_WEIGHT = 10;

    /**
     * The weights keyed by module, composed from the named constants above.
     * This is the lookup used by the score calculation and returned verbatim in
     * the health-score response — the single source of truth for both.
     *
     * @var array<string, int>
     */
    private const WEIGHTS = [
        'fleet' => self::FLEET_WEIGHT,
        'drivers' => self::DRIVER_WEIGHT,
        'capacity' => self::CAPACITY_WEIGHT,
        'dispatch' => self::DISPATCH_WEIGHT,
        'operations' => self::OPERATIONS_WEIGHT,
    ];

    public function __construct(
        private readonly CrossModuleValidationService $validation,
    ) {}

    /**
     * The Enterprise Readiness Dashboard — score, overall status, module
     * summary and the checklist in one payload.
     *
     * @return array<string, mixed>
     */
    public function dashboard(?string $companyId = null): array
    {
        $report = $this->validation->report($companyId);

        return [
            'generated_at' => $report['generated_at'],
            'health_score' => $this->scoreFrom($report),
            'overall_status' => $report['overall_status'],
            'ready_count' => $report['ready_count'],
            'degraded_count' => $report['degraded_count'],
            'not_ready_count' => $report['not_ready_count'],
            'modules' => $this->summariseModules($report),
            'checklist' => $this->checklistFrom($report),
        ];
    }

    /**
     * The Logistics Health Score, 0-100.
     *
     * @return array<string, mixed>
     */
    public function healthScore(?string $companyId = null): array
    {
        $report = $this->validation->report($companyId);
        $score = $this->scoreFrom($report);
        $grade = $this->grade($score);

        // Notification only — the score was computed above; this announces it.
        LogisticsHealthCalculated::dispatch(
            $score,
            $grade,
            $report['overall_status'],
            $companyId,
            $report['generated_at'],
        );

        return [
            'generated_at' => $report['generated_at'],
            'score' => $score,
            'grade' => $grade,
            'overall_status' => $report['overall_status'],
            'weights' => self::WEIGHTS,
        ];
    }

    /**
     * Module Readiness Summary — one line per authority.
     *
     * @return array<string, mixed>
     */
    public function moduleSummary(?string $companyId = null): array
    {
        $report = $this->validation->report($companyId);

        return [
            'generated_at' => $report['generated_at'],
            'overall_status' => $report['overall_status'],
            'modules' => $this->summariseModules($report),
        ];
    }

    /**
     * Operational Readiness Checklist — every check, flattened and grouped, so a
     * duty manager can see exactly what is and is not satisfied before a shift.
     *
     * @return array<string, mixed>
     */
    public function checklist(?string $companyId = null): array
    {
        $report = $this->validation->report($companyId);
        $items = $this->checklistFrom($report);

        return [
            'generated_at' => $report['generated_at'],
            'overall_status' => $report['overall_status'],
            'items' => $items,
            'passed' => count(array_filter($items, static fn ($i) => $i['passed'])),
            'total' => count($items),
            // What actually blocks go-live, called out.
            'blocking_failures' => array_values(array_filter(
                $items,
                static fn ($i) => ! $i['passed'] && $i['severity'] === 'blocking',
            )),
        ];
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $report
     */
    private function scoreFrom(array $report): int
    {
        $total = array_sum(self::WEIGHTS);
        $earned = 0.0;

        foreach ($report['modules'] as $module) {
            $weight = self::WEIGHTS[$module['module']] ?? 0;

            $earned += $weight * match ($module['status']) {
                CrossModuleValidationService::READY => 1.0,
                CrossModuleValidationService::DEGRADED => 0.5,
                default => 0.0,
            };
        }

        return (int) round(($earned / $total) * 100);
    }

    private function grade(int $score): string
    {
        return match (true) {
            $score >= 90 => 'A',
            $score >= 75 => 'B',
            $score >= 60 => 'C',
            $score >= 40 => 'D',
            default => 'F',
        };
    }

    /**
     * @param  array<string, mixed>  $report
     * @return list<array<string, mixed>>
     */
    private function summariseModules(array $report): array
    {
        return array_map(static fn (array $m) => [
            'module' => $m['module'],
            'label' => $m['label'],
            'status' => $m['status'],
            'passed_checks' => $m['passed_checks'],
            'total_checks' => $m['total_checks'],
            // The first reason is the headline; the rest are in the checklist.
            'headline' => $m['reasons'][0] ?? null,
            'weight' => self::WEIGHTS[$m['module']] ?? 0,
        ], $report['modules']);
    }

    /**
     * @param  array<string, mixed>  $report
     * @return list<array<string, mixed>>
     */
    private function checklistFrom(array $report): array
    {
        $items = [];

        foreach ($report['modules'] as $module) {
            foreach ($module['checks'] as $check) {
                $items[] = [
                    'id' => $module['module'].'.'.$check['name'],
                    'module' => $module['module'],
                    'module_label' => $module['label'],
                    'label' => $this->humanise($check['name']),
                    'passed' => $check['passed'],
                    'severity' => $check['severity'],
                    'detail' => $check['detail'],
                ];
            }
        }

        return $items;
    }

    private function humanise(string $name): string
    {
        return ucfirst(str_replace('_', ' ', $name));
    }
}
