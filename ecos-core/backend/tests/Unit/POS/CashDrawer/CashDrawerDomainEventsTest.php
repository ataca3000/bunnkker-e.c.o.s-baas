<?php

declare(strict_types=1);

namespace Tests\Unit\POS\CashDrawer;

use Modules\POS\CashDrawer\Domain\Events\CashInRecorded;
use Modules\POS\CashDrawer\Domain\Events\CashOutRecorded;
use Modules\POS\CashDrawer\Domain\Events\ClosingCountRecorded;
use Modules\POS\CashDrawer\Domain\Events\DrawerClosed;
use Modules\POS\CashDrawer\Domain\Events\DrawerOpened;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use PHPUnit\Framework\TestCase;

final class CashDrawerDomainEventsTest extends TestCase
{
    // ── DomainEvent contract ──────────────────────────────────────────────────

    public function test_drawer_opened_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->drawerOpened());
    }

    public function test_cash_in_recorded_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->cashInRecorded());
    }

    public function test_cash_out_recorded_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->cashOutRecorded());
    }

    public function test_closing_count_recorded_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->closingCountRecorded());
    }

    public function test_drawer_closed_implements_domain_event(): void
    {
        $this->assertInstanceOf(DomainEvent::class, $this->drawerClosed());
    }

    // ── eventName() ──────────────────────────────────────────────────────────

    public function test_drawer_opened_event_name(): void
    {
        $this->assertSame('pos.drawer.opened', $this->drawerOpened()->eventName());
    }

    public function test_cash_in_recorded_event_name(): void
    {
        $this->assertSame('pos.drawer.cash_in_recorded', $this->cashInRecorded()->eventName());
    }

    public function test_cash_out_recorded_event_name(): void
    {
        $this->assertSame('pos.drawer.cash_out_recorded', $this->cashOutRecorded()->eventName());
    }

    public function test_closing_count_recorded_event_name(): void
    {
        $this->assertSame('pos.drawer.closing_count_recorded', $this->closingCountRecorded()->eventName());
    }

    public function test_drawer_closed_event_name(): void
    {
        $this->assertSame('pos.drawer.closed', $this->drawerClosed()->eventName());
    }

    // ── eventVersion() ───────────────────────────────────────────────────────

    public function test_all_events_are_version_1(): void
    {
        $this->assertSame(1, $this->drawerOpened()->eventVersion());
        $this->assertSame(1, $this->cashInRecorded()->eventVersion());
        $this->assertSame(1, $this->cashOutRecorded()->eventVersion());
        $this->assertSame(1, $this->closingCountRecorded()->eventVersion());
        $this->assertSame(1, $this->drawerClosed()->eventVersion());
    }

    // ── occurredAt() UTC ─────────────────────────────────────────────────────

    public function test_all_events_have_utc_occurred_at(): void
    {
        $events = [
            $this->drawerOpened(),
            $this->cashInRecorded(),
            $this->cashOutRecorded(),
            $this->closingCountRecorded(),
            $this->drawerClosed(),
        ];

        foreach ($events as $event) {
            $this->assertSame('UTC', $event->occurredAt()->getTimezone()->getName());
        }
    }

    // ── unique event IDs ─────────────────────────────────────────────────────

    public function test_each_drawer_opened_fires_unique_event_id(): void
    {
        $a = $this->drawerOpened();
        $b = $this->drawerOpened();
        $this->assertNotSame($a->eventId(), $b->eventId());
    }

    public function test_each_cash_in_recorded_fires_unique_event_id(): void
    {
        $a = $this->cashInRecorded();
        $b = $this->cashInRecorded();
        $this->assertNotSame($a->eventId(), $b->eventId());
    }

    // ── toArray() required keys ───────────────────────────────────────────────

    public function test_drawer_opened_to_array_keys(): void
    {
        $data = $this->drawerOpened()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'event_version', 'correlation_id',
            'drawer_id', 'terminal_id', 'session_id', 'shift_id', 'cashier_id',
            'currency', 'opening_float'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_cash_in_recorded_to_array_keys(): void
    {
        $data = $this->cashInRecorded()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'drawer_id', 'movement_id',
            'shift_id', 'amount', 'currency', 'note'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_cash_out_recorded_to_array_keys(): void
    {
        $data = $this->cashOutRecorded()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'drawer_id', 'movement_id',
            'shift_id', 'amount', 'currency', 'note'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_closing_count_recorded_to_array_keys(): void
    {
        $data = $this->closingCountRecorded()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'drawer_id',
            'shift_id', 'actual_count', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    public function test_drawer_closed_to_array_keys(): void
    {
        $data = $this->drawerClosed()->toArray();
        foreach (['event_id', 'event_name', 'occurred_at', 'drawer_id', 'shift_id',
            'terminal_id', 'opening_float', 'expected_balance', 'closing_count',
            'variance', 'currency'] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing key: $key");
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function drawerOpened(): DrawerOpened
    {
        return DrawerOpened::now('drawer-1', 'terminal-1', 'session-1', 'shift-1', 'cashier-1', 'EGP', '500.00');
    }

    private function cashInRecorded(): CashInRecorded
    {
        return CashInRecorded::now('drawer-1', 'mov-1', 'shift-1', '100.00', 'EGP', 'deposit');
    }

    private function cashOutRecorded(): CashOutRecorded
    {
        return CashOutRecorded::now('drawer-1', 'mov-2', 'shift-1', '50.00', 'EGP', null);
    }

    private function closingCountRecorded(): ClosingCountRecorded
    {
        return ClosingCountRecorded::now('drawer-1', 'shift-1', '550.00', 'EGP');
    }

    private function drawerClosed(): DrawerClosed
    {
        return DrawerClosed::now('drawer-1', 'shift-1', 'terminal-1', '500.00', '550.00', '550.00', '0.00', 'EGP');
    }
}
