<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventBus;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventRegistry;
use Modules\Platform\EventPlatform\Domain\Models\StoredEvent;
use stdClass;
use Tests\Platform\EventPlatform\Fixtures\TestOrderCreatedEvent;
use Tests\Platform\EventPlatform\Fixtures\TestOrderSubscriber;
use Tests\TestCase;

class EnterpriseEventBusTest extends TestCase
{
    use RefreshDatabase;

    private EnterpriseEventBus $bus;

    private EnterpriseEventRegistry $registry;

    protected function setUp(): void
    {
        parent::setUp();
        $this->bus = $this->app->make(EnterpriseEventBus::class);
        $this->registry = $this->app->make(EnterpriseEventRegistry::class);
    }

    public function test_publish_persists_event_to_store(): void
    {
        $event = TestOrderCreatedEvent::make();
        $this->bus->publish($event);

        $this->assertDatabaseHas('enterprise_events', [
            'event_id' => $event->eventId(),
            'event_name' => $event->eventName(),
        ]);
    }

    public function test_publish_marks_event_as_published(): void
    {
        $event = TestOrderCreatedEvent::make();
        $this->bus->publish($event);

        $stored = StoredEvent::where('event_id', $event->eventId())->first();
        $this->assertEquals('published', $stored->status->value);
    }

    public function test_subscribe_registers_subscriber(): void
    {
        $this->bus->subscribe('orders.order_created', TestOrderSubscriber::class);
        $subscribers = $this->registry->getSubscribersFor('orders.order_created');

        $this->assertCount(1, $subscribers);
        $this->assertEquals(TestOrderSubscriber::class, $subscribers[0]['class']);
    }

    public function test_subscribe_prevents_duplicate_registration(): void
    {
        $this->bus->subscribe('orders.order_created', TestOrderSubscriber::class);
        $this->bus->subscribe('orders.order_created', TestOrderSubscriber::class);

        $subscribers = $this->registry->getSubscribersFor('orders.order_created');
        $this->assertCount(1, $subscribers);
    }

    public function test_subscribers_sorted_by_priority(): void
    {
        $this->bus->subscribe('orders.order_created', TestOrderSubscriber::class, priority: 50);
        $this->bus->subscribe('orders.order_created', stdClass::class, priority: 10);

        $subscribers = $this->registry->getSubscribersFor('orders.order_created');
        $this->assertEquals(10, $subscribers[0]['priority']);
        $this->assertEquals(50, $subscribers[1]['priority']);
    }

    public function test_publish_many_persists_all_events(): void
    {
        $events = [TestOrderCreatedEvent::make(), TestOrderCreatedEvent::make()];
        $this->bus->publishMany($events);

        foreach ($events as $event) {
            $this->assertDatabaseHas('enterprise_events', ['event_id' => $event->eventId()]);
        }
    }
}
