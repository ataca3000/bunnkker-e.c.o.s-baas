<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Services;

use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Platform\EventPlatform\Application\Jobs\HandleEnterpriseEventJob;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventRegistryInterface;
use Modules\Platform\EventPlatform\Domain\Models\StoredEvent;

final class EnterpriseEventDispatcher
{
    public function __construct(
        private readonly EnterpriseEventRegistryInterface $registry,
    ) {}

    /**
     * Dispatch the event to all registered subscribers.
     * Each subscriber gets its own queued job — fully decoupled.
     */
    public function dispatch(DomainEvent $event, StoredEvent $storedEvent): void
    {
        $eventName = $event->eventName();
        $subscribers = $this->registry->getSubscribersFor($eventName);

        if (empty($subscribers)) {
            return;
        }

        foreach ($subscribers as $definition) {
            HandleEnterpriseEventJob::dispatch(
                event: $event,
                subscriberClass: $definition['class'],
                retryPolicy: $definition['retry_policy'],
                storedEventId: $storedEvent->id,
                queue: $definition['queue'],
            );
        }
    }

    /**
     * Chunk-dispatch a large batch of events without overwhelming the queue.
     *
     * @param  DomainEvent[]  $events
     */
    public function dispatchBatch(array $events, array $storedEvents): void
    {
        $chunks = array_chunk(
            array_map(null, $events, $storedEvents),
            50,
        );

        foreach ($chunks as $chunk) {
            foreach ($chunk as [$event, $stored]) {
                if ($event && $stored) {
                    $this->dispatch($event, $stored);
                }
            }
        }
    }
}
