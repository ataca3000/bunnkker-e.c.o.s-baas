<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Infrastructure\Bus;

use Illuminate\Contracts\Events\Dispatcher;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;

/**
 * Laravel implementation of DomainEventBus.
 *
 * Wraps Laravel's synchronous event dispatcher. The event object itself
 * is dispatched directly — listeners receive a typed DomainEvent instance.
 *
 * This class lives in Infrastructure and is the ONLY place where
 * Inventory domain code touches Laravel's event system.
 *
 * The business layer (Actions) depend only on DomainEventBus (interface),
 * never on this class or Illuminate\Contracts\Events\Dispatcher.
 */
final class LaravelDomainEventBus implements DomainEventBus
{
    public function __construct(
        private readonly Dispatcher $dispatcher,
    ) {}

    public function publish(DomainEvent $event): void
    {
        // Dispatch the event object directly. Laravel resolves listeners
        // by the concrete class name, so each event class can have its
        // own dedicated listeners registered in DomainEventServiceProvider.
        $this->dispatcher->dispatch($event);
    }
}
