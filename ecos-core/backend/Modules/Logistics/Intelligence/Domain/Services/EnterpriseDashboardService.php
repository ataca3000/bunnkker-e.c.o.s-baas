<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Automation\Domain\Services\AutomationMonitoringService;
use Modules\Logistics\Operations\Domain\Services\CrossModuleValidationService;
use Modules\Logistics\Operations\Domain\Services\OperationalHealthService;
use Modules\Logistics\Operations\Domain\Services\ReadinessValidationService;

/**
 * The enterprise dashboards — one aggregated payload for the executive view and
 * one for the operations view.
 *
 * ┌─ ONE CALL INSTEAD OF EIGHT ─────────────────────────────────────────────┐
 * │ The performance win of this layer is round-trip reduction: each dashboard │
 * │ is a SINGLE aggregated read that a workspace renders in one request,      │
 * │ rather than the eight separate calls the raw intelligence/operations      │
 * │ endpoints would require. Every figure is still the owning module's —      │
 * │ this composes, it never recomputes.                                       │
 * │                                                                          │
 * │ Read-model only: nothing stored, nothing cached, no new table.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class EnterpriseDashboardService
{
    public function __construct(
        private readonly ReadinessValidationService $readiness,
        private readonly OperationalHealthService $health,
        private readonly DecisionEngine $decisions,
        private readonly ForecastService $forecasts,
        private readonly InsightService $insights,
        private readonly CrossModuleValidationService $validation,
        private readonly AutomationMonitoringService $automation,
    ) {}

    /**
     * The Executive Dashboard — health, headline exceptions, the top decision,
     * and the three forecasts, in one glance.
     *
     * @return array<string, mixed>
     */
    public function executive(?string $companyId = null): array
    {
        $score = $this->readiness->healthScore($companyId);
        $overview = $this->health->overview($companyId);
        $decision = $this->decisions->decide($companyId);

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'health' => [
                'score' => $score['score'],
                'grade' => $score['grade'],
                'overall_status' => $score['overall_status'],
            ],
            'is_quiet' => $overview['is_quiet'],
            'headline' => $overview['headline'],
            'decisions' => [
                'total' => $decision['recommendation_count'],
                'by_severity' => $decision['by_severity'],
                'top_priority' => $decision['top_priority'],
            ],
            'forecasts' => [
                'capacity' => $this->forecasts->capacityForecast($companyId)['projected_status'],
                'dispatch_pressure' => $this->forecasts->dispatchForecast($companyId)['projected_pressure'],
                'workload' => $this->forecasts->workloadForecast($companyId)['projected_level'],
            ],
        ];
    }

    /**
     * The Operations Dashboard — module readiness, the binding bottleneck, the
     * top suggestions, capacity warnings, and the automation wiring.
     *
     * @return array<string, mixed>
     */
    public function operations(?string $companyId = null): array
    {
        $report = $this->validation->report($companyId);

        return [
            'generated_at' => Carbon::now()->toIso8601String(),
            'overall_status' => $report['overall_status'],
            'modules' => array_map(static fn (array $m) => [
                'module' => $m['module'],
                'label' => $m['label'],
                'status' => $m['status'],
                'headline' => $m['reasons'][0] ?? null,
            ], $report['modules']),
            'bottleneck' => $this->insights->bottlenecks($companyId)['primary'],
            'suggestions' => $this->insights->smartSuggestions($companyId, 5),
            'capacity_warnings' => $this->insights->capacityWarnings($companyId)['warnings'],
            // The automation layer's wiring — consumers and queue health.
            'automation' => [
                'consumer_count' => $this->automation->monitoring()['consumer_count'],
                'policy_count' => $this->automation->monitoring()['policy_count'],
            ],
        ];
    }
}
