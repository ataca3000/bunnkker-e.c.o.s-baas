<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Terminal;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;
use Modules\POS\Terminal\Domain\Enums\TerminalStatus;
use Modules\POS\Terminal\Domain\Exceptions\InvalidTerminalStatusTransitionException;
use Modules\POS\Terminal\Domain\Models\Terminal;
use Modules\POS\Terminal\Domain\ValueObjects\HardwareConfig;
use Tests\TestCase;

/**
 * PKG-POS-003: Terminal aggregate invariant tests.
 *
 * Tests all domain invariants and the status-transition state machine
 * purely in-memory — no database is touched, so these run without a
 * running PostgreSQL instance.
 *
 * The state machine under test:
 *
 *   Inactive ──activate()──▶ Active ──putInMaintenance()──▶ Maintenance
 *                ▲                ▲─────activate()──────────────┘
 *                │                │
 *                └─deactivate()───┘
 *   Maintenance ──deactivate()──▶ Inactive
 *
 * Invalid:  Inactive ──putInMaintenance()──▶ ❌
 */
final class TerminalAggregateTest extends TestCase
{
    // No RefreshDatabase — all tests are purely in-memory.

    private string $branchId = 'branch-uuid-1';

    private string $warehouseId = 'warehouse-uuid-1';

    private function makeTerminal(string $code = 'POS-01'): Terminal
    {
        return Terminal::register(
            terminalCode: $code,
            name: 'Test Terminal',
            branchId: $this->branchId,
            warehouseId: $this->warehouseId,
            hardwareConfig: HardwareConfig::default(),
        );
    }

    // ── Registration invariants ───────────────────────────────────────────────

    public function test_register_creates_terminal_with_inactive_status(): void
    {
        $terminal = $this->makeTerminal();

        $this->assertSame(TerminalStatus::Inactive, $terminal->status);
        $this->assertTrue($terminal->isInactive());
        $this->assertFalse($terminal->isActive());
        $this->assertFalse($terminal->isInMaintenance());
    }

    public function test_register_uppercases_terminal_code(): void
    {
        $terminal = Terminal::register(
            terminalCode: 'pos-02',
            name: 'Lower-case Test',
            branchId: $this->branchId,
            warehouseId: $this->warehouseId,
            hardwareConfig: HardwareConfig::default(),
        );

        $this->assertSame('POS-02', $terminal->terminal_code);
    }

    public function test_register_trims_name(): void
    {
        $terminal = Terminal::register(
            terminalCode: 'POS-03',
            name: '  Checkout  ',
            branchId: $this->branchId,
            warehouseId: $this->warehouseId,
            hardwareConfig: HardwareConfig::default(),
        );

        $this->assertSame('Checkout', $terminal->name);
    }

    public function test_register_stores_hardware_config_as_array(): void
    {
        $config = new HardwareConfig('thermal_58mm', true, false, true, 'ws://agent:9000');
        $terminal = Terminal::register('POS-04', 'T4', $this->branchId, $this->warehouseId, $config);

        $this->assertTrue($config->equals($terminal->getHardwareConfig()));
    }

    public function test_register_rejects_empty_code(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Terminal code cannot be empty');

        Terminal::register('', 'Name', $this->branchId, $this->warehouseId, HardwareConfig::default());
    }

    public function test_register_rejects_whitespace_only_code(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Terminal::register('   ', 'Name', $this->branchId, $this->warehouseId, HardwareConfig::default());
    }

    public function test_register_rejects_empty_name(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Terminal name cannot be empty');

        Terminal::register('POS-05', '', $this->branchId, $this->warehouseId, HardwareConfig::default());
    }

    public function test_register_assigns_branch_and_warehouse(): void
    {
        $terminal = $this->makeTerminal();

        $this->assertSame($this->branchId, $terminal->branch_id);
        $this->assertSame($this->warehouseId, $terminal->warehouse_id);
    }

    // ── Activate ──────────────────────────────────────────────────────────────

    public function test_inactive_transitions_to_active_on_activate(): void
    {
        $terminal = $this->makeTerminal();
        $terminal->activate();

        $this->assertSame(TerminalStatus::Active, $terminal->status);
        $this->assertTrue($terminal->isActive());
    }

    public function test_maintenance_transitions_to_active_on_activate(): void
    {
        $terminal = $this->makeTerminal();
        $terminal->activate();
        $terminal->putInMaintenance();

        $terminal->activate();

        $this->assertSame(TerminalStatus::Active, $terminal->status);
    }

    public function test_activate_throws_when_already_active(): void
    {
        $terminal = $this->makeTerminal();
        $terminal->activate();

        $this->expectException(InvalidTerminalStatusTransitionException::class);
        $this->expectExceptionMessage('already in state "active"');

        $terminal->activate();
    }

    // ── Deactivate ────────────────────────────────────────────────────────────

    public function test_active_transitions_to_inactive_on_deactivate(): void
    {
        $terminal = $this->makeTerminal();
        $terminal->activate();

        $terminal->deactivate();

        $this->assertSame(TerminalStatus::Inactive, $terminal->status);
    }

    public function test_maintenance_transitions_to_inactive_on_deactivate(): void
    {
        $terminal = $this->makeTerminal();
        $terminal->activate();
        $terminal->putInMaintenance();

        $terminal->deactivate();

        $this->assertSame(TerminalStatus::Inactive, $terminal->status);
    }

    public function test_deactivate_throws_when_already_inactive(): void
    {
        $terminal = $this->makeTerminal();

        $this->expectException(InvalidTerminalStatusTransitionException::class);
        $this->expectExceptionMessage('already in state "inactive"');

        $terminal->deactivate();
    }

    // ── Put In Maintenance ────────────────────────────────────────────────────

    public function test_active_transitions_to_maintenance(): void
    {
        $terminal = $this->makeTerminal();
        $terminal->activate();

        $terminal->putInMaintenance();

        $this->assertSame(TerminalStatus::Maintenance, $terminal->status);
        $this->assertTrue($terminal->isInMaintenance());
    }

    public function test_put_in_maintenance_throws_from_inactive(): void
    {
        $terminal = $this->makeTerminal();

        $this->expectException(InvalidTerminalStatusTransitionException::class);
        $this->expectExceptionMessage('cannot transition from "inactive" to "maintenance"');

        $terminal->putInMaintenance();
    }

    public function test_put_in_maintenance_throws_from_maintenance(): void
    {
        $terminal = $this->makeTerminal();
        $terminal->activate();
        $terminal->putInMaintenance();

        $this->expectException(InvalidTerminalStatusTransitionException::class);
        $this->expectExceptionMessage('cannot transition from "maintenance" to "maintenance"');

        $terminal->putInMaintenance();
    }

    // ── Hardware config ───────────────────────────────────────────────────────

    public function test_update_hardware_config_replaces_existing(): void
    {
        $terminal = $this->makeTerminal();
        $newConfig = HardwareConfig::minimal();

        $terminal->updateHardwareConfig($newConfig);

        $this->assertTrue($newConfig->equals($terminal->getHardwareConfig()));
    }

    public function test_get_hardware_config_returns_vo(): void
    {
        $config = HardwareConfig::default();
        $terminal = Terminal::register('POS-06', 'T6', $this->branchId, $this->warehouseId, $config);

        $retrieved = $terminal->getHardwareConfig();

        $this->assertInstanceOf(HardwareConfig::class, $retrieved);
        $this->assertTrue($config->equals($retrieved));
    }

    // ── Heartbeat ─────────────────────────────────────────────────────────────

    public function test_record_heartbeat_sets_ip_and_timestamp(): void
    {
        $terminal = $this->makeTerminal();
        $at = new DateTimeImmutable('2026-07-01 10:00:00', new DateTimeZone('UTC'));

        $terminal->recordHeartbeat($at, '10.0.0.5');

        $this->assertSame('10.0.0.5', $terminal->last_seen_ip);
    }

    // ── Domain model / TerminalStatus integration ─────────────────────────────

    public function test_status_can_accept_sessions_only_when_active(): void
    {
        $terminal = $this->makeTerminal();

        $this->assertFalse($terminal->status->canAcceptSessions(), 'inactive');

        $terminal->activate();
        $this->assertTrue($terminal->status->canAcceptSessions(), 'active');

        $terminal->putInMaintenance();
        $this->assertFalse($terminal->status->canAcceptSessions(), 'maintenance');
    }

    public function test_full_lifecycle_inactive_active_maintenance_active_inactive(): void
    {
        $terminal = $this->makeTerminal();

        $this->assertSame(TerminalStatus::Inactive, $terminal->status);

        $terminal->activate();
        $this->assertSame(TerminalStatus::Active, $terminal->status);

        $terminal->putInMaintenance();
        $this->assertSame(TerminalStatus::Maintenance, $terminal->status);

        $terminal->activate();
        $this->assertSame(TerminalStatus::Active, $terminal->status);

        $terminal->deactivate();
        $this->assertSame(TerminalStatus::Inactive, $terminal->status);
    }
}
