<?php

declare(strict_types=1);

namespace Modules\POS\Application\Contracts;

use Modules\POS\Shared\Domain\Contracts\DomainEvent;

interface DomainEventPublisherInterface
{
    /** @param DomainEvent[] $events */
    public function publishAll(array $events): void;
}
