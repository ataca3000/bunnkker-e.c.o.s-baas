<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Contracts;

use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;

interface EnterpriseEventRegistryInterface
{
    /**
     * Register a subscriber for an event.
     * The subscriber class must have a handle() method that accepts the event.
     */
    public function subscribe(
        string $eventName,
        string $subscriberClass,
        RetryPolicy $retryPolicy,
        int $priority,
        string $queue,
    ): void;

    /**
     * Returns sorted array of subscriber definitions for the given event name.
     * Each entry: ['class' => FQCN, 'retry_policy' => RetryPolicy, 'priority' => int, 'queue' => string]
     *
     * @return array<int, array{class: string, retry_policy: RetryPolicy, priority: int, queue: string}>
     */
    public function getSubscribersFor(string $eventName): array;

    public function isRegistered(string $eventName): bool;

    public function allEventNames(): array;

    public function allSubscriberClasses(string $eventName): array;
}
