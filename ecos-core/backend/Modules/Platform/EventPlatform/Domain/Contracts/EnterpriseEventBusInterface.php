<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Contracts;

use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;

interface EnterpriseEventBusInterface
{
    /**
     * Publish a domain event through the Enterprise Event Platform.
     *
     * Accepts both new EnterpriseEvent subclasses and legacy DomainEvent objects.
     * The event is persisted to the event store and dispatched to all registered subscribers.
     */
    public function publish(DomainEvent $event): void;

    /**
     * Register a subscriber class for a given event name.
     *
     * @param  string  $eventName  Dot-notation event name, e.g. 'orders.order_created'
     * @param  string  $subscriberClass  FQCN of the subscriber class (must have handle() method)
     * @param  RetryPolicy  $retryPolicy  Retry policy for this subscriber
     * @param  int  $priority  Lower number = higher dispatch priority
     * @param  string  $queue  Laravel queue name
     */
    public function subscribe(
        string $eventName,
        string $subscriberClass,
        ?RetryPolicy $retryPolicy = null,
        int $priority = 100,
        string $queue = 'default',
    ): void;
}
