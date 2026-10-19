<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Core\BusinessAttribution\Application\Actions\RecordJourneyStepAction;
use Modules\Core\BusinessAttribution\Application\Services\BusinessJourneyService;
use Modules\Core\BusinessAttribution\Domain\Enums\JourneyStage;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\BusinessDnaResource;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\JourneyStepResource;

class JourneyExplorerController extends Controller
{
    public function __construct(
        private readonly BusinessJourneyService $journeyService,
        private readonly RecordJourneyStepAction $recordStepAction,
    ) {}

    /**
     * Search journeys — the primary Journey Explorer workspace endpoint.
     * Supports filtering by entity_type, company, campaign, initiative, stage reached.
     */
    public function search(Request $request): AnonymousResourceCollection
    {
        $filters = $request->only([
            'entity_type', 'company_id', 'campaign_id',
            'initiative_id', 'has_stage', 'customer_lifetime_stage',
        ]);

        $perPage = min((int) $request->query('per_page', 25), 100);
        $journeys = $this->journeyService->searchJourneys($filters, $perPage);

        return BusinessDnaResource::collection($journeys);
    }

    /**
     * Get the full ordered journey for a DNA record.
     * Used by Journey Explorer drill-down and Journey Visualization component.
     */
    public function journey(BusinessDna $businessDna): JsonResponse
    {
        $journey = $this->journeyService->buildJourney($businessDna->id);
        $journey['steps'] = JourneyStepResource::collection($journey['steps'])->resolve();

        return response()->json(['data' => $journey]);
    }

    /**
     * Record a new journey step.
     * Any ECOS module calls this to advance an entity through the business lifecycle.
     */
    public function recordStep(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entity_type' => ['required', 'string'],
            'entity_id' => ['required', 'uuid'],
            'journey_stage' => ['required', 'string'],
            'event_id' => ['nullable', 'uuid'],
            'actor_id' => ['nullable', 'uuid'],
            'actor_type' => ['nullable', 'string', 'max:100'],
            'occurred_at' => ['nullable', 'date'],
            'related_entity_id' => ['nullable', 'uuid'],
            'related_entity_type' => ['nullable', 'string', 'max:100'],
            'payload' => ['nullable', 'array'],
            'dna_defaults' => ['nullable', 'array'],
        ]);

        $step = $this->recordStepAction->execute(
            $data['entity_type'],
            $data['entity_id'],
            JourneyStage::from($data['journey_stage']),
            array_filter($data, static fn ($k) => in_array($k, [
                'event_id', 'actor_id', 'actor_type', 'occurred_at',
                'related_entity_id', 'related_entity_type', 'payload',
            ], true), ARRAY_FILTER_USE_KEY),
            $data['dna_defaults'] ?? [],
        );

        return response()->json(['data' => new JourneyStepResource($step)], 201);
    }
}
