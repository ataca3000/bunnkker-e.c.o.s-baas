<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Services;

use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Contracts\DomainEvent as PosDomainEvent;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventBusInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventRegistryInterface;
use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;

/**
 * Central event bus for the Enterprise Event Platform.
 *
 * All modules publish and subscribe through this class.
 * No module should call Event::dispatch() or Event::listen() directly for cross-module communication.
 */
final class EnterpriseEventBus implements DomainEventBus, EnterpriseEventBusInterface
{
    public function __construct(
        private readonly EnterpriseEventPublisher $publisher,
        private readonly EnterpriseEventRegistryInterface $registry,
    ) {}

    /**
     * Publish an event. Accepts both:
     * - New EnterpriseEvent subclasses (PKG-17+ events)
     * - Legacy DomainEvent implementations (bridged automatically)
     */
    public function publish(DomainEvent|PosDomainEvent $event): void
    {
        $this->publisher->publish($event);
    }

    /**
     * Register a subscriber for an event name.
     *
     * @example
     * $bus->subscribe(
     *     'preparation.wave_created',
     *     WaveCreatedListener::class,
     *     RetryPolicy::standard(),
     *     priority: 50,
     *     queue: 'demand',
     * );
     */
    public function subscribe(
        string $eventName,
        string $subscriberClass,
        ?RetryPolicy $retryPolicy = null,
        int $priority = 100,
        string $queue = 'default',
    ): void {
        $this->registry->subscribe(
            eventName: $eventName,
            subscriberClass: $subscriberClass,
            retryPolicy: $retryPolicy ?? RetryPolicy::standard(),
            priority: $priority,
            queue: $queue,
        );
    }

    /**
     * Publish multiple events in a single batch — e.g. from a domain aggregate root.
     *
     * @param  DomainEvent[]  $events
     */
    public function publishMany(array $events): void
    {
        $this->publisher->publishMany($events);
    }
}
