<?php

declare(strict_types=1);

namespace Tests\Feature\Inventory;

use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\Products\Domain\Exceptions\UnknownInventoryClassException;
use Modules\Inventory\Products\Domain\Models\Product;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The inventory_class contract (EPIC-FIN-INTEGRATION-003).
 *
 * inventory_class decides which GL account a stock movement lands on, so the
 * properties worth pinning are: it never invents a class, it never defaults, and
 * it can never drift away from the product_type it is derived from.
 */
class InventoryClassContractTest extends TestCase
{
    /**
     * The drift guard. Product.product_type is the source of truth; this enum is
     * its typed form. If someone adds a product type without adding a class,
     * inventory postings for that type would fail at runtime instead of here.
     */
    public function test_the_enum_matches_product_types_exactly(): void
    {
        $enum = InventoryClass::values();
        $product = Product::TYPES;

        sort($enum);
        sort($product);

        $this->assertSame(
            $product,
            $enum,
            'InventoryClass and Product::TYPES have drifted. Every product type must have '.
            'an accounting class, and no class may exist without a product type.',
        );
    }

    #[DataProvider('productTypes')]
    public function test_every_product_type_resolves_to_a_class(string $productType): void
    {
        $this->assertSame($productType, InventoryClass::fromProductType($productType)->value);
    }

    /** @return array<string, array{string}> */
    public static function productTypes(): array
    {
        return array_combine(
            Product::TYPES,
            array_map(static fn (string $t): array => [$t], Product::TYPES),
        );
    }

    #[DataProvider('unclassifiable')]
    public function test_an_unclassifiable_product_is_refused_not_defaulted(?string $productType): void
    {
        $this->expectException(UnknownInventoryClassException::class);

        InventoryClass::fromProductType($productType, 'prod-123');
    }

    /** @return array<string, array{string|null}> */
    public static function unclassifiable(): array
    {
        return [
            'null' => [null],
            'empty' => [''],
            'unknown value' => ['consumable'],
            'wrong case' => ['RAW_MATERIAL'],
            // WIP is an accounting state, never a product classification.
            'work in progress' => ['work_in_progress'],
        ];
    }

    public function test_the_refusal_names_the_value_and_the_product(): void
    {
        try {
            InventoryClass::fromProductType('consumable', 'prod-abc');
            $this->fail('Expected the unclassifiable product to be refused.');
        } catch (UnknownInventoryClassException $e) {
            $this->assertStringContainsString('consumable', $e->getMessage());
            $this->assertStringContainsString('prod-abc', $e->getMessage());
            $this->assertStringContainsString('raw_material', $e->getMessage());
        }
    }
}
