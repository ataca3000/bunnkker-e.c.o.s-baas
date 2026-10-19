<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Carbon\Carbon;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\EntityState;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\TimestampContext;

class TimeMachineService
{
    public function __construct(
        private readonly EntityStateResolver $resolver,
    ) {}

    /**
     * Return the reconstructed entity state at a specific point in time.
     */
    public function resolveAt(string $entityType, string $entityId, Carbon $asOf): EntityState
    {
        return $this->resolver->resolve($entityType, $entityId, $asOf);
    }

    /**
     * Return a structured historical view: state + temporal context metadata.
     */
    public function getHistoricalView(string $entityType, string $entityId, Carbon $asOf): array
    {
        $context = TimestampContext::at($asOf);
        $state = $this->resolveAt($entityType, $entityId, $asOf);

        return [
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'timestamp_context' => $context->toArray(),
            'state' => $state->toArray(),
            'is_historical' => $context->isHistorical(),
        ];
    }

    public function createContext(Carbon $asOf): TimestampContext
    {
        return TimestampContext::at($asOf);
    }

    /**
     * Compute the field-level diff between entity state at two timestamps.
     */
    public function diff(
        string $entityType,
        string $entityId,
        Carbon $from,
        Carbon $to,
    ): array {
        $stateFrom = $this->resolveAt($entityType, $entityId, $from);
        $stateTo = $this->resolveAt($entityType, $entityId, $to);

        $added = [];
        $removed = [];
        $changed = [];

        foreach ($stateTo->state as $key => $valueNew) {
            if (! array_key_exists($key, $stateFrom->state)) {
                $added[$key] = $valueNew;
            } elseif ($stateFrom->state[$key] !== $valueNew) {
                $changed[$key] = [
                    'from' => $stateFrom->state[$key],
                    'to' => $valueNew,
                ];
            }
        }

        foreach ($stateFrom->state as $key => $value) {
            if (! array_key_exists($key, $stateTo->state)) {
                $removed[$key] = $value;
            }
        }

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'events_in_range' => $stateTo->eventsApplied - $stateFrom->eventsApplied,
            'added' => $added,
            'removed' => $removed,
            'changed' => $changed,
            'has_changes' => ! empty($added) || ! empty($removed) || ! empty($changed),
        ];
    }

    /**
     * Alias for resolveAt — expressive name for the rewind use case.
     */
    public function rewindTo(string $entityType, string $entityId, Carbon $asOf): EntityState
    {
        return $this->resolveAt($entityType, $entityId, $asOf);
    }
}
