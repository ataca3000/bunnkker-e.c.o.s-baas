<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Services;

use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Contracts\DomainEvent as PosDomainEvent;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;

/**
 * Thin façade: serializes + persists + hands off to dispatcher.
 * The EventBus delegates here after subscriber registration is resolved.
 */
final class EnterpriseEventPublisher
{
    public function __construct(
        private readonly EnterpriseEventStoreInterface $store,
        private readonly EnterpriseEventDispatcher $dispatcher,
        private readonly EnterpriseEventSerializer $serializer,
    ) {}

    public function publish(DomainEvent|PosDomainEvent $event): void
    {
        // Persist to event store
        $storedEvent = $this->store->persist($event);

        // Mark published before dispatching
        $this->store->markPublished($event->eventId());

        // Dispatch to subscribers asynchronously
        $this->dispatcher->dispatch($event, $storedEvent);
    }

    /** Publish multiple events from a single aggregate operation. */
    public function publishMany(array $events): void
    {
        if (empty($events)) {
            return;
        }

        $stored = [];
        foreach ($events as $event) {
            $storedEvent = $this->store->persist($event);
            $this->store->markPublished($event->eventId());
            $stored[] = $storedEvent;
        }

        $this->dispatcher->dispatchBatch($events, $stored);
    }
}
