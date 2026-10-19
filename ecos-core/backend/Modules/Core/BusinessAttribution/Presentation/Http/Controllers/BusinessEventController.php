<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Core\BusinessAttribution\Application\Actions\PublishBusinessEventAction;
use Modules\Core\BusinessAttribution\Application\Services\BusinessEventBusService;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;
use Modules\Core\BusinessAttribution\Presentation\Http\Resources\BusinessEventResource;

class BusinessEventController extends Controller
{
    public function __construct(
        private readonly BusinessEventBusService $bus,
        private readonly PublishBusinessEventAction $publishAction,
    ) {}

    /** Cross-module enterprise timeline with filters. */
    public function timeline(Request $request): AnonymousResourceCollection
    {
        $filters = $request->only([
            'company_id', 'category', 'producer_module',
            'date_from', 'date_to', 'search',
        ]);

        $perPage = min((int) $request->query('per_page', 50), 200);
        $events = $this->bus->timeline($filters, $perPage);

        return BusinessEventResource::collection($events);
    }

    /** Events scoped to a DNA record. */
    public function forDna(Request $request, string $dnaId): AnonymousResourceCollection
    {
        $perPage = min((int) $request->query('per_page', 25), 100);
        $events = $this->bus->getByDna($dnaId, $perPage);

        return BusinessEventResource::collection($events);
    }

    /** Events scoped to a specific entity. */
    public function forEntity(Request $request): AnonymousResourceCollection
    {
        $request->validate([
            'entity_type' => ['required', 'string'],
            'entity_id' => ['required', 'uuid'],
        ]);

        $perPage = min((int) $request->query('per_page', 25), 100);
        $events = $this->bus->getByEntity(
            $request->query('entity_type'),
            $request->query('entity_id'),
            $perPage,
        );

        return BusinessEventResource::collection($events);
    }

    /** Show a single event. */
    public function show(BusinessEvent $businessEvent): BusinessEventResource
    {
        return new BusinessEventResource($businessEvent);
    }

    /**
     * Publish a new Business Event — the Module Integration API endpoint.
     * Any ECOS module POSTs here to register a business event.
     */
    public function publish(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event_name' => ['required', 'string', 'max:150'],
            'category' => ['required', 'string'],
            'producer_module' => ['required', 'string', 'max:100'],
            'producer_entity' => ['required', 'string', 'max:100'],
            'entity_id' => ['nullable', 'uuid'],
            'entity_type' => ['nullable', 'string', 'max:100'],
            'company_id' => ['nullable', 'uuid'],
            'brand_id' => ['nullable', 'uuid'],
            'channel_id' => ['nullable', 'uuid'],
            'warehouse_id' => ['nullable', 'uuid'],
            'business_unit' => ['nullable', 'string', 'max:100'],
            'cost_center' => ['nullable', 'string', 'max:100'],
            'actor_id' => ['nullable', 'uuid'],
            'actor_type' => ['nullable', 'string', 'max:100'],
            'occurred_at' => ['nullable', 'date'],
            'correlation_id' => ['nullable', 'uuid'],
            'business_dna_id' => ['nullable', 'uuid'],
            'payload' => ['required', 'array'],
            'metadata' => ['nullable', 'array'],
            'version' => ['nullable', 'string', 'max:10'],
        ]);

        $event = $this->publishAction->execute($data);

        return response()->json(new BusinessEventResource($event), 201);
    }
}
