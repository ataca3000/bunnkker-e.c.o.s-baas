<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Carbon\Carbon;
use Illuminate\Support\Collection;
use Modules\Core\BusinessAttribution\Domain\Contracts\EntityStateApplierInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\EntityState;

class EntityStateResolver
{
    /** @var EntityStateApplierInterface[] */
    private array $appliers = [];

    public function register(EntityStateApplierInterface $applier): void
    {
        $this->appliers[] = $applier;
    }

    /**
     * Rebuild entity state by replaying all events up to $asOf.
     */
    public function resolve(string $entityType, string $entityId, ?Carbon $asOf = null): EntityState
    {
        $asOf ??= Carbon::now();

        $events = BusinessEvent::query()
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->where('occurred_at', '<=', $asOf)
            ->where('replay_compatible', true)
            ->orderBy('occurred_at')
            ->orderBy('created_at')
            ->get();

        return $this->resolveFromEvents($events, $entityType, $entityId, $asOf);
    }

    /**
     * Rebuild state from a pre-fetched event collection.
     * Used by EnhancedReplayService to avoid double-querying.
     */
    public function resolveFromEvents(
        Collection $events,
        string $entityType,
        string $entityId,
        Carbon $asOf,
    ): EntityState {
        $applier = $this->findApplier($entityType);
        $state = $applier->initialState($entityId);
        $applied = 0;
        $lastAt = null;
        $appliedIds = [];

        foreach ($events as $event) {
            $state = $applier->apply($state, $event);
            $applied++;
            $lastAt = $event->occurred_at;
            $appliedIds[] = $event->id;
        }

        return new EntityState(
            entityType: $entityType,
            entityId: $entityId,
            asOf: $asOf,
            state: $state,
            eventsApplied: $applied,
            lastEventAt: $lastAt,
            appliedEvents: $appliedIds,
        );
    }

    /** Returns the class names of all registered appliers. */
    public function getSupportedTypes(): array
    {
        return array_map(static fn ($a) => get_class($a), $this->appliers);
    }

    private function findApplier(string $entityType): EntityStateApplierInterface
    {
        foreach ($this->appliers as $applier) {
            if ($applier->supports($entityType)) {
                return $applier;
            }
        }

        // Generic pass-through for unregistered entity types
        return new class implements EntityStateApplierInterface
        {
            public function supports(string $entityType): bool
            {
                return true;
            }

            public function initialState(string $entityId): array
            {
                return ['id' => $entityId, 'events' => []];
            }

            public function apply(array $currentState, BusinessEvent $event): array
            {
                $currentState['events'][] = $event->event_name;
                $currentState['last_event'] = $event->event_name;
                $currentState['last_event_at'] = $event->occurred_at->toIso8601String();

                return $currentState;
            }
        };
    }
}
