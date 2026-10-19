<?php

declare(strict_types=1);

namespace Modules\POS\Application\Infrastructure\EventPublishing;

use Modules\POS\Application\Contracts\DomainEventPublisherInterface;

final class LaravelDomainEventPublisher implements DomainEventPublisherInterface
{
    public function publishAll(array $events): void
    {
        foreach ($events as $event) {
            event($event);
        }
    }
}
