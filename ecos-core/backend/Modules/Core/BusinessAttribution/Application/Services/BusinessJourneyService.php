<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Carbon\Carbon;
use Illuminate\Support\Str;
use Modules\Core\BusinessAttribution\Domain\Enums\JourneyStage;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;
use Modules\Core\BusinessAttribution\Domain\Models\JourneyStep;

/**
 * Business Journey Engine — records and queries the full business lifecycle.
 */
final class BusinessJourneyService
{
    public function __construct(
        private readonly BusinessMetricsService $metricsService,
    ) {}

    /**
     * Record a new journey step for a Business DNA record.
     *
     * @param  array<string, mixed>  $stepData
     */
    public function recordStep(
        string $dnaId,
        JourneyStage $stage,
        array $stepData = [],
    ): JourneyStep {
        $dna = BusinessDna::with('journeySteps')->findOrFail($dnaId);

        // Find previous step in the journey
        $previousStep = $dna->journeySteps->sortByDesc('occurred_at')->first();

        $occurredAt = isset($stepData['occurred_at'])
            ? Carbon::parse($stepData['occurred_at'])
            : Carbon::now();

        $durationSeconds = null;
        if ($previousStep !== null) {
            $durationSeconds = (int) abs($occurredAt->diffInSeconds(Carbon::parse($previousStep->occurred_at)));
        }

        $step = JourneyStep::create([
            'id' => Str::uuid()->toString(),
            'business_dna_id' => $dnaId,
            'journey_stage' => $stage->value,
            'event_id' => $stepData['event_id'] ?? null,
            'actor_id' => $stepData['actor_id'] ?? null,
            'actor_type' => $stepData['actor_type'] ?? null,
            'occurred_at' => $occurredAt,
            'duration_seconds' => $durationSeconds,
            'previous_step_id' => $previousStep?->id,
            'related_entity_id' => $stepData['related_entity_id'] ?? null,
            'related_entity_type' => $stepData['related_entity_type'] ?? null,
            'payload' => $stepData['payload'] ?? null,
            'created_at' => Carbon::now(),
        ]);

        // Recalculate metrics asynchronously (sync for now)
        $this->metricsService->recalculate($dna);

        return $step;
    }

    /**
     * Build the full ordered journey for a DNA record.
     *
     * @return array{
     *   dna_id: string,
     *   entity_type: string,
     *   entity_id: string,
     *   steps: \Illuminate\Support\Collection<int, JourneyStep>,
     *   total_steps: int,
     *   first_at: string|null,
     *   last_at: string|null,
     *   stages_reached: string[],
     * }
     */
    public function buildJourney(string $dnaId): array
    {
        $dna = BusinessDna::with('journeySteps')->findOrFail($dnaId);
        $steps = $dna->journeySteps->sortBy('occurred_at')->values();

        return [
            'dna_id' => $dna->id,
            'entity_type' => $dna->entity_type->value,
            'entity_id' => $dna->entity_id,
            'steps' => $steps,
            'total_steps' => $steps->count(),
            'first_at' => $steps->first()?->occurred_at?->toIso8601String(),
            'last_at' => $steps->last()?->occurred_at?->toIso8601String(),
            'stages_reached' => $steps->pluck('journey_stage')->map(fn ($s) => $s instanceof JourneyStage ? $s->value : $s)->unique()->values()->all(),
        ];
    }

    /**
     * Search journeys by entity type, stage, date range.
     *
     * @param  array<string, mixed>  $filters
     */
    public function searchJourneys(array $filters = [], int $perPage = 25): \Illuminate\Pagination\LengthAwarePaginator
    {
        $query = BusinessDna::query()->with(['journeySteps', 'metrics']);

        if (! empty($filters['entity_type'])) {
            $query->where('entity_type', $filters['entity_type']);
        }
        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }
        if (! empty($filters['campaign_id'])) {
            $query->where('campaign_id', $filters['campaign_id']);
        }
        if (! empty($filters['initiative_id'])) {
            $query->where('initiative_id', $filters['initiative_id']);
        }
        if (! empty($filters['customer_lifetime_stage'])) {
            $query->where('customer_lifetime_stage', $filters['customer_lifetime_stage']);
        }
        if (! empty($filters['has_stage'])) {
            $query->whereHas('journeySteps', static function ($q) use ($filters): void {
                $q->where('journey_stage', $filters['has_stage']);
            });
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }
}
