<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Services;

use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventRegistryInterface;
use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;

final class EnterpriseEventRegistry implements EnterpriseEventRegistryInterface
{
    /**
     * In-memory registry: eventName → [['class' => FQCN, 'retry_policy' => RetryPolicy, 'priority' => int, 'queue' => string], ...]
     *
     * @var array<string, array<int, array{class: string, retry_policy: RetryPolicy, priority: int, queue: string}>>
     */
    private array $subscribers = [];

    public function subscribe(
        string $eventName,
        string $subscriberClass,
        RetryPolicy $retryPolicy,
        int $priority = 100,
        string $queue = 'default',
    ): void {
        if (! isset($this->subscribers[$eventName])) {
            $this->subscribers[$eventName] = [];
        }

        // Prevent double-registration
        foreach ($this->subscribers[$eventName] as $existing) {
            if ($existing['class'] === $subscriberClass) {
                return;
            }
        }

        $this->subscribers[$eventName][] = [
            'class' => $subscriberClass,
            'retry_policy' => $retryPolicy,
            'priority' => $priority,
            'queue' => $queue,
        ];

        // Sort by priority ascending (lower number = runs first)
        usort($this->subscribers[$eventName], fn ($a, $b) => $a['priority'] <=> $b['priority']);
    }

    public function getSubscribersFor(string $eventName): array
    {
        return $this->subscribers[$eventName] ?? [];
    }

    public function isRegistered(string $eventName): bool
    {
        return ! empty($this->subscribers[$eventName]);
    }

    public function allEventNames(): array
    {
        return array_keys($this->subscribers);
    }

    public function allSubscriberClasses(string $eventName): array
    {
        return array_column($this->getSubscribersFor($eventName), 'class');
    }
}
