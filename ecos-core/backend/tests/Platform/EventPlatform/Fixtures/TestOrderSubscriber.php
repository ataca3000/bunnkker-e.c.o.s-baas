<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform\Fixtures;

use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Platform\EventPlatform\Application\Contracts\EnterpriseEventSubscriberInterface;

final class TestOrderSubscriber implements EnterpriseEventSubscriberInterface
{
    public static int $callCount = 0;

    public function handle(DomainEvent $event): void
    {
        self::$callCount++;
    }

    public function subscribesTo(): array
    {
        return ['orders.order_created'];
    }

    public function minSupportedVersion(): int
    {
        return 1;
    }

    public function maxSupportedVersion(): int
    {
        return 0;
    }
}
