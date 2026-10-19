<?php

declare(strict_types=1);

namespace Modules\POS\Shared\Domain\Contracts;

interface DomainEventBus
{
    public function publish(DomainEvent $event): void;
}
