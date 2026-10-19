<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Carbon\Carbon;
use Generator;
use Illuminate\Support\Collection;
use Modules\Core\BusinessAttribution\Domain\Contracts\ReplayHookInterface;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayContext;
use Modules\Core\BusinessAttribution\Domain\ValueObjects\ReplayResult;

class EnhancedReplayService
{
    /** @var ReplayHookInterface[] */
    private array $hooks = [];

    public function registerHook(ReplayHookInterface $hook): void
    {
        $this->hooks[] = $hook;
    }

    /**
     * Primary replay entry point — uses a structured context object.
     * Runs all registered hooks and returns a typed ReplayResult.
     */
    public function replayWithContext(ReplayContext $context): ReplayResult
    {
        $start = microtime(true);

        foreach ($this->hooks as $hook) {
            $hook->beforeReplay($context);
        }

        $events = $this->fetchEvents($context);

        // Allow hooks to transform the state during event traversal
        if (! empty($this->hooks)) {
            $state = [];
            foreach ($events as $event) {
                foreach ($this->hooks as $hook) {
                    $state = $hook->onEvent($event, $state);
                }
            }
        }

        $result = new ReplayResult(
            entityType: $context->entityType,
            entityId: $context->entityId,
            events: $events,
            totalEvents: $events->count(),
            replayedAt: Carbon::now(),
            durationMs: (int) ((microtime(true) - $start) * 1000),
            from: $context->from,
            to: $context->to,
            replayType: $context->replayType,
            metadata: ['purpose' => $context->purpose],
        );

        foreach ($this->hooks as $hook) {
            $hook->afterReplay($result);
        }

        return $result;
    }

    public function replayEventRange(
        string $entityType,
        string $entityId,
        Carbon $from,
        Carbon $to,
    ): ReplayResult {
        return $this->replayWithContext(
            ReplayContext::eventRange($entityType, $entityId, $from, $to),
        );
    }

    /**
     * Replay all events produced by a specific module within a date range.
     */
    public function replayModule(string $moduleName, Carbon $from, Carbon $to): ReplayResult
    {
        $start = microtime(true);

        $events = BusinessEvent::query()
            ->where('producer_module', $moduleName)
            ->whereBetween('occurred_at', [$from, $to])
            ->orderBy('occurred_at')
            ->get();

        return new ReplayResult(
            entityType: 'module',
            entityId: $moduleName,
            events: $events,
            totalEvents: $events->count(),
            replayedAt: Carbon::now(),
            durationMs: (int) ((microtime(true) - $start) * 1000),
            from: $from,
            to: $to,
            replayType: 'module',
        );
    }

    /**
     * Replay multiple entities in one call.
     *
     * @param  array<array{entity_type: string, entity_id: string}>  $entities
     * @return array<string, ReplayResult> Keyed by entity_id
     */
    public function batchReplay(array $entities): array
    {
        $results = [];

        foreach ($entities as $entity) {
            $context = ReplayContext::entity($entity['entity_type'], $entity['entity_id']);
            $results[$entity['entity_id']] = $this->replayWithContext($context);
        }

        return $results;
    }

    /**
     * Stream events lazily using a PHP generator — safe for millions of events.
     *
     * @return Generator<int, BusinessEvent>
     */
    public function streamEvents(ReplayContext $context): Generator
    {
        $query = BusinessEvent::query()
            ->where('entity_type', $context->entityType)
            ->where('entity_id', $context->entityId)
            ->where('replay_compatible', true)
            ->orderBy('occurred_at');

        if ($context->from) {
            $query->where('occurred_at', '>=', $context->from);
        }
        if ($context->to) {
            $query->where('occurred_at', '<=', $context->to);
        }

        // cursor() returns a LazyCollection — each row is fetched on demand
        foreach ($query->cursor() as $event) {
            yield $event;
        }
    }

    private function fetchEvents(ReplayContext $context): Collection
    {
        $query = BusinessEvent::query()
            ->where('entity_type', $context->entityType)
            ->where('entity_id', $context->entityId)
            ->where('replay_compatible', true)
            ->orderBy('occurred_at')
            ->limit($context->maxEvents);

        if ($context->from) {
            $query->where('occurred_at', '>=', $context->from);
        }
        if ($context->to) {
            $query->where('occurred_at', '<=', $context->to);
        }

        return $query->get();
    }
}
