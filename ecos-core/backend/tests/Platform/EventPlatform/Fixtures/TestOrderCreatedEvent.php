<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform\Fixtures;

use Illuminate\Support\Str;
use Modules\Platform\EventPlatform\Domain\Abstracts\EnterpriseEvent;

/**
 * Minimal concrete EnterpriseEvent for tests.
 * Mirrors a future orders.order_created event.
 */
final class TestOrderCreatedEvent extends EnterpriseEvent
{
    public function getEventName(): string
    {
        return 'orders.order_created';
    }

    public function getVersion(): string
    {
        return '1.0.0';
    }

    public function getModule(): string
    {
        return 'commerce.orders';
    }

    public function getAggregateType(): string
    {
        return 'Order';
    }

    public static function make(
        string $companyId = 'test-company',
        string $aggregateId = '',
        ?string $correlationId = null,
    ): self {
        $instance = new self;
        $instance->initializeEventFields(
            companyId: $companyId,
            aggregateId: $aggregateId ?: Str::uuid()->toString(),
            payload: ['order_number' => 'ORD-TEST-001', 'total' => 100.0],
            correlationId: $correlationId,
        );

        return $instance;
    }
}
