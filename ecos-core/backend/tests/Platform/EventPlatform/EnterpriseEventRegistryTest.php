<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform;

use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventRegistry;
use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;
use Tests\Platform\EventPlatform\Fixtures\TestOrderSubscriber;
use Tests\TestCase;

class EnterpriseEventRegistryTest extends TestCase
{
    private EnterpriseEventRegistry $registry;

    protected function setUp(): void
    {
        parent::setUp();
        $this->registry = new EnterpriseEventRegistry;
    }

    public function test_subscribe_and_get_subscribers(): void
    {
        $this->registry->subscribe('orders.created', TestOrderSubscriber::class, RetryPolicy::standard(), 100, 'default');

        $subscribers = $this->registry->getSubscribersFor('orders.created');
        $this->assertCount(1, $subscribers);
        $this->assertEquals(TestOrderSubscriber::class, $subscribers[0]['class']);
    }

    public function test_unregistered_event_returns_empty_array(): void
    {
        $this->assertEmpty($this->registry->getSubscribersFor('orders.shipped'));
    }

    public function test_is_registered_returns_correct_value(): void
    {
        $this->assertFalse($this->registry->isRegistered('orders.created'));

        $this->registry->subscribe('orders.created', TestOrderSubscriber::class, RetryPolicy::none(), 100, 'default');

        $this->assertTrue($this->registry->isRegistered('orders.created'));
    }

    public function test_all_event_names(): void
    {
        $this->registry->subscribe('orders.created', TestOrderSubscriber::class, RetryPolicy::none(), 100, 'default');
        $this->registry->subscribe('orders.cancelled', TestOrderSubscriber::class, RetryPolicy::none(), 100, 'default');

        $names = $this->registry->allEventNames();
        $this->assertContains('orders.created', $names);
        $this->assertContains('orders.cancelled', $names);
    }

    public function test_priority_sorting(): void
    {
        $this->registry->subscribe('orders.created', 'ClassA', RetryPolicy::none(), 100, 'default');
        $this->registry->subscribe('orders.created', 'ClassB', RetryPolicy::none(), 10, 'default');
        $this->registry->subscribe('orders.created', 'ClassC', RetryPolicy::none(), 50, 'default');

        $subscribers = $this->registry->getSubscribersFor('orders.created');
        $this->assertEquals('ClassB', $subscribers[0]['class']);
        $this->assertEquals('ClassC', $subscribers[1]['class']);
        $this->assertEquals('ClassA', $subscribers[2]['class']);
    }

    public function test_deduplication(): void
    {
        $this->registry->subscribe('orders.created', TestOrderSubscriber::class, RetryPolicy::none(), 100, 'default');
        $this->registry->subscribe('orders.created', TestOrderSubscriber::class, RetryPolicy::none(), 100, 'default');

        $this->assertCount(1, $this->registry->getSubscribersFor('orders.created'));
    }

    public function test_retry_policy_is_stored(): void
    {
        $this->registry->subscribe('orders.created', TestOrderSubscriber::class, RetryPolicy::aggressive(), 100, 'default');

        $subscriber = $this->registry->getSubscribersFor('orders.created')[0];
        $this->assertEquals(6, $subscriber['retry_policy']->getMaxAttempts());
    }
}
