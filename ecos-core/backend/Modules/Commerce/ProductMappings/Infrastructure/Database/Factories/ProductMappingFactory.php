<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * @extends Factory<ProductMapping>
 */
final class ProductMappingFactory extends Factory
{
    /**
     * @var class-string<ProductMapping>
     */
    protected $model = ProductMapping::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'channel_id' => Channel::factory(),
            'external_product_id' => (string) $this->faker->numberBetween(100, 9999),
            'external_sku' => $this->faker->optional()->bothify('EXT-??###'),
            'sync_status' => $this->faker->randomElement(SyncStatus::cases())->value,
            'last_sync_at' => null,
        ];
    }
}
