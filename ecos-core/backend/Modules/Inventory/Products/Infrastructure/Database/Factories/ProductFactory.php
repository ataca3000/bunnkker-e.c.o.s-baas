<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Inventory\Products\Domain\Enums\CostSource;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Categories\Domain\Models\Category;
use Modules\MasterData\Units\Domain\Models\Unit;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * @extends Factory<Product>
 */
final class ProductFactory extends Factory
{
    /**
     * @var class-string<Product>
     */
    protected $model = Product::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'sku' => strtoupper($this->faker->unique()->bothify('SKU-#####')),
            'barcode' => (string) $this->faker->ean13(),
            'name' => ucwords($this->faker->unique()->words(2, true)),
            'description' => $this->faker->sentence(),
            'brand_id' => Brand::factory(),
            // Derived from the brand: a product and its brand must belong to the
            // same company, and the column is NOT NULL.
            'company_id' => fn (array $attributes) => Brand::find($attributes['brand_id'])?->company_id,
            'category_id' => Category::factory(),
            'unit_id' => Unit::factory(),
            'product_type' => $this->faker->randomElement(Product::TYPES),
            'is_active' => true,
            'cost_source' => CostSource::Purchase->value,
            'can_manufacture' => false,
            'can_disassemble' => false,
            'allow_negative_stock' => false,
        ];
    }

    public function finishedGood(): self
    {
        return $this->state(fn (): array => ['product_type' => Product::TYPE_FINISHED_GOOD]);
    }

    public function rawMaterial(): self
    {
        return $this->state(fn (): array => ['product_type' => Product::TYPE_RAW_MATERIAL]);
    }

    public function manufacturable(): self
    {
        return $this->state(fn (): array => [
            'can_manufacture' => true,
            'cost_source' => CostSource::Recipe->value,
        ]);
    }

    public function hybrid(): self
    {
        return $this->state(fn (): array => [
            'can_manufacture' => true,
            'can_disassemble' => true,
            'cost_source' => CostSource::Hybrid->value,
        ]);
    }

    public function allowsNegativeStock(): self
    {
        return $this->state(fn (): array => ['allow_negative_stock' => true]);
    }
}
