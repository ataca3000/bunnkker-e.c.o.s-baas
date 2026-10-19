<?php

declare(strict_types=1);

namespace Modules\Logistics\Intelligence\Domain\Services;

use Modules\Logistics\Dispatch\Domain\Services\DispatchMonitoringService;
use Modules\Logistics\Operations\Domain\Services\CapacityMonitoringService;
use Modules\Logistics\Operations\Domain\Services\ExceptionQueryService;

/**
 * Forward-looking projections — capacity, dispatch and workload.
 *
 * ┌─ DETERMINISTIC PROJECTION, NOT A BLACK BOX ─────────────────────────────┐
 * │ Every forecast is transparent arithmetic over figures the owning modules │
 * │ already produced. There is no model, no training data, and no opaque     │
 * │ weighting — a human can reproduce each number by hand, which is exactly  │
 * │ what makes it trustworthy for an operational decision.                   │
 * │                                                                          │
 * │ Each result is stamped `method: deterministic_projection` so a consumer  │
 * │ never mistakes it for a statistical prediction. A future ML backend      │
 * │ could serve the same read contract without changing this API.            │
 * │                                                                          │
 * │ Read-model only: nothing is stored, nothing is cached.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class ForecastService
{
    private const METHOD = 'deterministic_projection';

    public function __construct(
        private readonly CapacityMonitoringService $capacity,
        private readonly DispatchMonitoringService $dispatch,
        private readonly ExceptionQueryService $exceptions,
    ) {}

    /**
     * Capacity forecast — where the current window is heading.
     *
     * @return array<string, mixed>
     */
    public function capacityForecast(?string $companyId = null): array
    {
        $overview = $this->capacity->overview($companyId);
        $stats = $this->capacity->reservationStatistics($companyId);

        $utilisation = $overview['avg_utilisation'];
        $headroom = $utilisation === null ? null : round(max(0.0, 1.0 - $utilisation), 4);

        $status = match (true) {
            $overview['slot_count'] > 0 && $overview['exhausted'] >= $overview['slot_count'] => 'exhausted',
            $utilisation !== null && $utilisation >= 0.85 => 'at_risk',
            $utilisation !== null && $utilisation >= 0.6 => 'tightening',
            $utilisation === null => 'no_data',
            default => 'comfortable',
        };

        return [
            'method' => self::METHOD,
            'horizon' => 'current_window',
            'avg_utilisation' => $utilisation,
            'headroom_share' => $headroom,
            'exhausted_slots' => $overview['exhausted'],
            'near_capacity_slots' => $overview['at_warn_threshold'],
            'currently_holding' => $stats['currently_holding'],
            'refusal_rate' => $stats['refusal_rate'],
            'projected_status' => $status,
            'note' => 'Projected from the current window\'s utilisation and refusals — not a statistical prediction.',
        ];
    }

    /**
     * Dispatch forecast — the pressure on the dispatch pipeline.
     *
     * @return array<string, mixed>
     */
    public function dispatchForecast(?string $companyId = null): array
    {
        $queue = $this->dispatch->queueStatistics($companyId);
        $kpis = $this->dispatch->kpis($companyId);

        // Pressure rises with depth, stuck items and a poor confirmation rate.
        $pressure = match (true) {
            $queue['stuck'] > 0 || $queue['depth'] >= 20 => 'severe',
            $queue['needs_action'] >= 8 => 'high',
            $queue['depth'] >= 1 => 'moderate',
            default => 'low',
        };

        return [
            'method' => self::METHOD,
            'horizon' => 'today',
            'queue_depth' => $queue['depth'],
            'needs_action' => $queue['needs_action'],
            'stuck' => $queue['stuck'],
            'oldest_wait_minutes' => $queue['oldest_wait_minutes'],
            'confirmation_rate' => $kpis['confirmation_rate'],
            'projected_pressure' => $pressure,
            'note' => 'Projected from current queue depth, stuck items and confirmation rate.',
        ];
    }

    /**
     * Workload forecast — how much needs a human across the operation.
     *
     * @return array<string, mixed>
     */
    public function workloadForecast(?string $companyId = null): array
    {
        $queue = $this->dispatch->queueStatistics($companyId);
        $exceptions = $this->exceptions->summary($companyId);

        // The total of everything demanding attention right now.
        $openWork = $queue['needs_action']
            + $exceptions['needs_attention']
            + $exceptions['critical'];

        $level = match (true) {
            $exceptions['critical'] > 0 || $openWork >= 20 => 'severe',
            $openWork >= 8 => 'high',
            $openWork >= 1 => 'moderate',
            default => 'low',
        };

        return [
            'method' => self::METHOD,
            'horizon' => 'now',
            'queue_needs_action' => $queue['needs_action'],
            'exceptions_needing_attention' => $exceptions['needs_attention'],
            'critical_exceptions' => $exceptions['critical'],
            'open_work_items' => $openWork,
            'projected_level' => $level,
            'note' => 'Projected from open queue work and the exception backlog.',
        ];
    }
}
