<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Commerce\Channels\Domain\Enums\ChannelPlatform;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Organization\Brands\Domain\Models\Brand;

/**
 * @extends Factory<Channel>
 */
final class ChannelFactory extends Factory
{
    /**
     * @var class-string<Channel>
     */
    protected $model = Channel::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'brand_id' => Brand::factory(),
            // Derived from the brand rather than minted separately: a channel and
            // its brand must belong to the same company, and the column is NOT
            // NULL. Leaving it unset made every suite touching this factory fail
            // on insert.
            'company_id' => fn (array $attributes) => Brand::find($attributes['brand_id'])?->company_id,
            'name' => $this->faker->company().' Store',
            'platform' => $this->faker->randomElement(ChannelPlatform::cases())->value,
            'store_url' => $this->faker->url(),
            'is_active' => $this->faker->boolean(80),
            'sync_products' => $this->faker->boolean(90),
            'sync_prices' => $this->faker->boolean(90),
            'sync_stock' => $this->faker->boolean(90),
            'last_sync_at' => null,
        ];
    }
}
