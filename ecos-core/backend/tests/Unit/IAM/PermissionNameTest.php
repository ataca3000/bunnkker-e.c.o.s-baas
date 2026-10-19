<?php

declare(strict_types=1);

namespace Tests\Unit\IAM;

use Modules\IAM\Domain\Exceptions\InvalidPermissionNameException;
use Modules\IAM\Domain\ValueObjects\PermissionName;
use PHPUnit\Framework\TestCase;

/**
 * TASK-IAM-002 Phase 1 — PermissionName value object.
 */
class PermissionNameTest extends TestCase
{
    public function test_parses_three_segment_name(): void
    {
        $name = PermissionName::from('inventory.products.view');

        $this->assertSame('inventory.products.view', $name->value());
        $this->assertSame('inventory', $name->module());
        $this->assertSame('products', $name->resource());
        $this->assertSame('view', $name->action());
    }

    public function test_parses_two_segment_module_wide_name(): void
    {
        $name = PermissionName::from('operations.view');

        $this->assertSame('operations.view', $name->value());
        $this->assertSame('operations', $name->module());
        $this->assertNull($name->resource());
        $this->assertSame('view', $name->action());
    }

    public function test_normalises_pascal_case_to_canonical_snake(): void
    {
        // The task's illustrative "Inventory.Products.ViewCost" must resolve to the
        // real stored name.
        $this->assertSame(
            'inventory.products.view_cost',
            PermissionName::from('Inventory.Products.ViewCost')->value(),
        );

        $this->assertSame(
            'manufacturing.recipes.view',
            PermissionName::from('Manufacturing.Recipes.View')->value(),
        );

        $this->assertSame(
            'iam.roles.assign',
            PermissionName::from('IAM.Roles.Assign')->value(),
        );
    }

    public function test_try_from_and_is_valid(): void
    {
        $this->assertInstanceOf(PermissionName::class, PermissionName::tryFrom('crm.customers.create'));
        $this->assertNull(PermissionName::tryFrom('invalid'));
        $this->assertTrue(PermissionName::isValid('sales.orders.export'));
        $this->assertFalse(PermissionName::isValid('a.b.c.d'));
    }

    /**
     * @dataProvider invalidNames
     */
    public function test_rejects_invalid_names(string $raw): void
    {
        $this->expectException(InvalidPermissionNameException::class);
        PermissionName::from($raw);
    }

    /** @return array<string, array{string}> */
    public static function invalidNames(): array
    {
        return [
            'single segment' => ['inventory'],
            'four segments' => ['fleet.maintenance.schedule.now'],
            'empty' => [''],
            'only dots' => ['...'],
            'hyphen in segment' => ['inventory.products.view-cost'],
            'space in segment' => ['inventory.products.view cost'],
            'leading digit' => ['1nventory.products.view'],
        ];
    }

    public function test_equality_and_string_cast(): void
    {
        $a = PermissionName::from('inventory.products.view');
        $b = PermissionName::from('Inventory.Products.View');
        $c = PermissionName::from('inventory.products.create');

        $this->assertTrue($a->equals($b));
        $this->assertFalse($a->equals($c));
        $this->assertSame('inventory.products.view', (string) $a);
    }
}
