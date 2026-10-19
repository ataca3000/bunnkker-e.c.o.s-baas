<?php

declare(strict_types=1);

namespace Tests\Feature\IAM;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\IAM\Domain\Contracts\PermissionRegistryInterface;
use Modules\IAM\Domain\Exceptions\InvalidPermissionNameException;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\ValueObjects\PermissionName;
use Tests\TestCase;

/**
 * TASK-IAM-002 Phase 1 — PermissionRegistry.
 */
class PermissionRegistryTest extends TestCase
{
    use RefreshDatabase;

    private function registry(): PermissionRegistryInterface
    {
        return app(PermissionRegistryInterface::class);
    }

    public function test_registry_is_a_singleton(): void
    {
        $this->assertSame($this->registry(), $this->registry());
    }

    public function test_discovers_existing_catalog_from_config(): void
    {
        $registry = $this->registry();

        $this->assertGreaterThan(0, $registry->count());
        $this->assertTrue($registry->has('inventory.products.view'));
    }

    public function test_module_can_register_itself(): void
    {
        $registry = $this->registry();
        $registry->register('inventory', ['widgets' => ['view', 'create']]);

        $this->assertTrue($registry->has('inventory.widgets.view'));
        $this->assertTrue($registry->has('inventory.widgets.create'));
    }

    public function test_registration_is_deduplicated(): void
    {
        $registry = $this->registry();
        $registry->register('inventory', ['gizmos' => ['view']]);
        $before = $registry->count();

        $registry->register('inventory', ['gizmos' => ['view']]);      // same again
        $registry->add(PermissionName::from('Inventory.Gizmos.View'));  // canonical dup

        $this->assertSame($before, $registry->count());
    }

    public function test_add_accepts_value_object_and_canonicalises(): void
    {
        $registry = $this->registry();
        $registry->add(PermissionName::from('Commerce.Orders.Export'));

        $this->assertTrue($registry->has('commerce.orders.export'));
        $this->assertContains('commerce.orders.export', $registry->all());
    }

    public function test_version_is_deterministic_and_changes_on_addition(): void
    {
        $registry = $this->registry();
        $v1 = $registry->version();

        $this->assertSame($v1, $registry->version()); // stable

        $registry->add('marketing.campaigns.launch');
        $this->assertNotSame($v1, $registry->version()); // changed
    }

    public function test_invalid_registration_throws(): void
    {
        $this->expectException(InvalidPermissionNameException::class);
        $this->registry()->add('not-a-valid-name');
    }

    public function test_sync_persists_catalog_idempotently(): void
    {
        $registry = $this->registry();

        // First sync processes every registered permission (some rows may already
        // exist from the enterprise-permission-matrix migration — that's fine).
        $first = $registry->sync();
        $this->assertSame($registry->count(), $first['total']);
        $countAfterFirst = Permission::count();

        // Every registered permission is now persisted.
        foreach ($registry->all() as $name) {
            $this->assertDatabaseHas('permissions', ['name' => $name]);
        }

        // Second sync creates nothing and adds no duplicate rows — idempotent.
        $second = $registry->sync();
        $this->assertSame(0, $second['created']);
        $this->assertSame($registry->count(), $second['existing']);
        $this->assertSame($countAfterFirst, Permission::count());
    }
}
