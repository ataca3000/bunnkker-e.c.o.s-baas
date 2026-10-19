<?php

declare(strict_types=1);

namespace Tests\Unit\POS\Terminal;

use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Terminal\Domain\Events\TerminalActivated;
use Modules\POS\Terminal\Domain\Events\TerminalDeactivated;
use Modules\POS\Terminal\Domain\Events\TerminalRegistered;
use PHPUnit\Framework\TestCase;

/**
 * PKG-POS-003: Terminal domain events unit tests.
 * Tests the DomainEvent contract and payload structure without any infrastructure.
 */
final class TerminalDomainEventsTest extends TestCase
{
    private const TERMINAL_ID = 'terminal-uuid-1';

    private const TERMINAL_CODE = 'POS-01';

    private const BRANCH_ID = 'branch-uuid-1';

    private const WAREHOUSE_ID = 'warehouse-uuid-1';

    private const ACTOR_ID = 'user-uuid-1';

    // -------------------------------------------------------------------------
    // TerminalRegistered
    // -------------------------------------------------------------------------

    public function test_terminal_registered_implements_domain_event(): void
    {
        $event = TerminalRegistered::now(
            self::TERMINAL_ID,
            self::TERMINAL_CODE,
            self::BRANCH_ID,
            self::WAREHOUSE_ID,
            self::ACTOR_ID,
        );

        $this->assertInstanceOf(DomainEvent::class, $event);
    }

    public function test_terminal_registered_event_name(): void
    {
        $event = TerminalRegistered::now(
            self::TERMINAL_ID,
            self::TERMINAL_CODE,
            self::BRANCH_ID,
            self::WAREHOUSE_ID,
            self::ACTOR_ID,
        );

        $this->assertSame('pos.terminal.registered', $event->eventName());
    }

    public function test_terminal_registered_version_is_one(): void
    {
        $event = TerminalRegistered::now(
            self::TERMINAL_ID,
            self::TERMINAL_CODE,
            self::BRANCH_ID,
            self::WAREHOUSE_ID,
            self::ACTOR_ID,
        );

        $this->assertSame(1, $event->eventVersion());
    }

    public function test_terminal_registered_event_id_equals_correlation_id_for_originating_event(): void
    {
        $event = TerminalRegistered::now(
            self::TERMINAL_ID,
            self::TERMINAL_CODE,
            self::BRANCH_ID,
            self::WAREHOUSE_ID,
            self::ACTOR_ID,
        );

        $this->assertSame($event->eventId(), $event->correlationId());
    }

    public function test_terminal_registered_to_array_contains_required_keys(): void
    {
        $event = TerminalRegistered::now(
            self::TERMINAL_ID,
            self::TERMINAL_CODE,
            self::BRANCH_ID,
            self::WAREHOUSE_ID,
            self::ACTOR_ID,
        );

        $array = $event->toArray();

        $this->assertArrayHasKey('event_id', $array);
        $this->assertArrayHasKey('event_name', $array);
        $this->assertArrayHasKey('occurred_at', $array);
        $this->assertArrayHasKey('event_version', $array);
        $this->assertArrayHasKey('correlation_id', $array);
        $this->assertArrayHasKey('terminal_id', $array);
        $this->assertArrayHasKey('terminal_code', $array);
        $this->assertArrayHasKey('branch_id', $array);
        $this->assertArrayHasKey('warehouse_id', $array);
        $this->assertArrayHasKey('actor_id', $array);
    }

    public function test_terminal_registered_payload_values(): void
    {
        $event = TerminalRegistered::now(
            self::TERMINAL_ID,
            self::TERMINAL_CODE,
            self::BRANCH_ID,
            self::WAREHOUSE_ID,
            self::ACTOR_ID,
        );

        $array = $event->toArray();

        $this->assertSame(self::TERMINAL_ID, $array['terminal_id']);
        $this->assertSame(self::TERMINAL_CODE, $array['terminal_code']);
        $this->assertSame(self::BRANCH_ID, $array['branch_id']);
        $this->assertSame(self::WAREHOUSE_ID, $array['warehouse_id']);
        $this->assertSame(self::ACTOR_ID, $array['actor_id']);
    }

    public function test_terminal_registered_occurred_at_is_utc(): void
    {
        $event = TerminalRegistered::now(
            self::TERMINAL_ID,
            self::TERMINAL_CODE,
            self::BRANCH_ID,
            self::WAREHOUSE_ID,
            self::ACTOR_ID,
        );

        $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
    }

    public function test_two_registered_events_have_different_event_ids(): void
    {
        $e1 = TerminalRegistered::now(self::TERMINAL_ID, self::TERMINAL_CODE, self::BRANCH_ID, self::WAREHOUSE_ID, self::ACTOR_ID);
        $e2 = TerminalRegistered::now(self::TERMINAL_ID, self::TERMINAL_CODE, self::BRANCH_ID, self::WAREHOUSE_ID, self::ACTOR_ID);

        $this->assertNotSame($e1->eventId(), $e2->eventId());
    }

    // -------------------------------------------------------------------------
    // TerminalActivated
    // -------------------------------------------------------------------------

    public function test_terminal_activated_implements_domain_event(): void
    {
        $event = TerminalActivated::now(self::TERMINAL_ID, self::TERMINAL_CODE, self::ACTOR_ID);

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.terminal.activated', $event->eventName());
    }

    public function test_terminal_activated_to_array(): void
    {
        $event = TerminalActivated::now(self::TERMINAL_ID, self::TERMINAL_CODE, self::ACTOR_ID);
        $array = $event->toArray();

        $this->assertSame(self::TERMINAL_ID, $array['terminal_id']);
        $this->assertSame(self::TERMINAL_CODE, $array['terminal_code']);
        $this->assertSame(self::ACTOR_ID, $array['actor_id']);
    }

    // -------------------------------------------------------------------------
    // TerminalDeactivated
    // -------------------------------------------------------------------------

    public function test_terminal_deactivated_implements_domain_event(): void
    {
        $event = TerminalDeactivated::now(self::TERMINAL_ID, self::TERMINAL_CODE, self::ACTOR_ID, 'Scheduled maintenance');

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('pos.terminal.deactivated', $event->eventName());
    }

    public function test_terminal_deactivated_includes_reason(): void
    {
        $event = TerminalDeactivated::now(self::TERMINAL_ID, self::TERMINAL_CODE, self::ACTOR_ID, 'End of day');
        $array = $event->toArray();

        $this->assertSame('End of day', $array['reason']);
    }

    public function test_terminal_deactivated_reason_defaults_to_empty_string(): void
    {
        $event = TerminalDeactivated::now(self::TERMINAL_ID, self::TERMINAL_CODE, self::ACTOR_ID);

        $this->assertSame('', $event->reason);
    }
}
