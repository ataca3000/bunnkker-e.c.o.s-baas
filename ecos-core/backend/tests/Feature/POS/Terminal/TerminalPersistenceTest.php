<?php

declare(strict_types=1);

namespace Tests\Feature\POS\Terminal;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Branches\Domain\Models\Branch;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\POS\Terminal\Domain\Contracts\TerminalRepositoryInterface;
use Modules\POS\Terminal\Domain\Enums\TerminalStatus;
use Modules\POS\Terminal\Domain\Models\Terminal;
use Modules\POS\Terminal\Domain\ValueObjects\HardwareConfig;
use Tests\TestCase;

/**
 * PKG-POS-003: Terminal repository persistence tests.
 *
 * Requires a running PostgreSQL database. These tests verify that the
 * EloquentTerminalRepository correctly persists and retrieves terminals,
 * and that Eloquent casts survive the DB round-trip.
 *
 * Run these tests when the database is available:
 *   php artisan test tests/Feature/POS/Terminal/TerminalPersistenceTest.php
 */
final class TerminalPersistenceTest extends TestCase
{
    use RefreshDatabase;

    private TerminalRepositoryInterface $repository;

    private Branch $branch;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();

        $this->repository = app(TerminalRepositoryInterface::class);

        $company = Company::factory()->create();
        $this->branch = Branch::factory()->create(['company_id' => $company->id]);
        $this->warehouse = Warehouse::factory()->create(['company_id' => $company->id]);
    }

    private function makeTerminal(string $code = 'POS-01'): Terminal
    {
        return Terminal::register(
            terminalCode: $code,
            name: 'Test Terminal',
            branchId: $this->branch->id,
            warehouseId: $this->warehouse->id,
            hardwareConfig: HardwareConfig::default(),
        );
    }

    public function test_save_and_find_by_id(): void
    {
        $terminal = $this->makeTerminal();
        $this->repository->save($terminal);

        $found = $this->repository->findById($terminal->id);

        $this->assertNotNull($found);
        $this->assertSame($terminal->id, $found->id);
        $this->assertSame('POS-01', $found->terminal_code);
        $this->assertSame(TerminalStatus::Inactive, $found->status);
    }

    public function test_find_by_id_returns_null_for_unknown(): void
    {
        $found = $this->repository->findById('00000000-0000-0000-0000-000000000000');

        $this->assertNull($found);
    }

    public function test_find_by_code_is_case_insensitive(): void
    {
        $terminal = $this->makeTerminal('POS-04');
        $this->repository->save($terminal);

        $found = $this->repository->findByCode('pos-04');

        $this->assertNotNull($found);
        $this->assertSame($terminal->id, $found->id);
    }

    public function test_status_enum_persists_correctly(): void
    {
        $terminal = $this->makeTerminal('POS-05');
        $terminal->activate();
        $this->repository->save($terminal);

        $found = $this->repository->findById($terminal->id);

        $this->assertNotNull($found);
        $this->assertSame(TerminalStatus::Active, $found->status);
        $this->assertTrue($found->isActive());
    }

    public function test_hardware_config_round_trips_through_database(): void
    {
        $config = new HardwareConfig('thermal_58mm', true, false, true, 'ws://agent:9000');
        $terminal = Terminal::register('POS-06', 'Name', $this->branch->id, $this->warehouse->id, $config);
        $this->repository->save($terminal);

        $found = $this->repository->findById($terminal->id);

        $this->assertNotNull($found);
        $this->assertTrue($config->equals($found->getHardwareConfig()));
    }

    public function test_exists_by_code_true_after_save(): void
    {
        $terminal = $this->makeTerminal('POS-07');
        $this->repository->save($terminal);

        $this->assertTrue($this->repository->existsByCode('POS-07'));
    }

    public function test_exists_by_code_false_for_unknown(): void
    {
        $this->assertFalse($this->repository->existsByCode('POS-UNKNOWN'));
    }

    public function test_exists_by_code_excludes_own_id_for_update(): void
    {
        $terminal = $this->makeTerminal('POS-08');
        $this->repository->save($terminal);

        $this->assertFalse(
            $this->repository->existsByCode('POS-08', $terminal->id),
            'A terminal should not conflict with itself when updating',
        );
    }

    public function test_find_by_branch_returns_only_that_branch(): void
    {
        $t1 = Terminal::register('POS-09', 'T1', $this->branch->id, $this->warehouse->id, HardwareConfig::default());
        $t2 = Terminal::register('POS-10', 'T2', $this->branch->id, $this->warehouse->id, HardwareConfig::default());

        $otherBranch = Branch::factory()->create(['company_id' => $this->branch->company_id]);
        $t3 = Terminal::register('POS-11', 'T3', $otherBranch->id, $this->warehouse->id, HardwareConfig::default());

        $this->repository->save($t1);
        $this->repository->save($t2);
        $this->repository->save($t3);

        $found = $this->repository->findByBranch($this->branch->id);
        $codes = array_map(fn (Terminal $t) => $t->terminal_code, $found);

        $this->assertCount(2, $found);
        $this->assertContains('POS-09', $codes);
        $this->assertContains('POS-10', $codes);
        $this->assertNotContains('POS-11', $codes);
    }

    public function test_heartbeat_persists(): void
    {
        $terminal = $this->makeTerminal('POS-12');
        $this->repository->save($terminal);

        $at = new DateTimeImmutable('2026-07-01 10:00:00', new DateTimeZone('UTC'));
        $terminal->recordHeartbeat($at, '192.168.1.50');
        $this->repository->save($terminal);

        $found = $this->repository->findById($terminal->id);

        $this->assertNotNull($found);
        $this->assertSame('192.168.1.50', $found->last_seen_ip);
    }

    public function test_delete_removes_from_database(): void
    {
        $terminal = $this->makeTerminal('POS-13');
        $this->repository->save($terminal);

        $this->repository->delete($terminal);

        $this->assertNull($this->repository->findById($terminal->id));
    }
}
