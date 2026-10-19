<?php

declare(strict_types=1);

namespace Modules\Inventory\DomainEvents\Contracts;

/**
 * Publish-only event bus for Inventory Domain Events.
 *
 * Intentionally framework-independent: the interface carries no Laravel imports.
 * The concrete implementation (LaravelDomainEventBus) lives in Infrastructure
 * and may depend on whatever transport is appropriate for the environment.
 *
 * Callers MUST only publish events after a successful transaction commit.
 * This contract carries no mechanism for deferral — deferral is the
 * caller's responsibility.
 */
interface DomainEventBus
{
    /**
     * Publish a single domain event to all registered subscribers.
     *
     * This method is fire-and-forget from the caller's perspective.
     * Implementations MUST NOT throw exceptions that leak transport
     * concerns into the domain layer.
     */
    public function publish(DomainEvent $event): void;
}
