<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * @extends Factory<BusinessAccount>
 */
final class BusinessAccountFactory extends Factory
{
    protected $model = BusinessAccount::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'brand_id' => null,
            'code' => 'BA-'.str_pad((string) $this->faker->unique()->numberBetween(1, 999999), 6, '0', STR_PAD_LEFT),
            'name' => $this->faker->company().' Account',
            'provider' => $this->faker->randomElement(['Meta', 'WooCommerce', 'Shopify', 'Amazon', 'TikTok', 'Google', 'Noon', 'Snapchat', 'Custom']),
            'status' => 'active',
            'description' => $this->faker->optional()->sentence(),
            'logo' => null,
            'oauth_config' => null,
            'api_keys' => null,
            'webhook_config' => null,
            'sync_settings' => null,
            'external_metadata' => null,
        ];
    }

    public function inactive(): static
    {
        return $this->state(['status' => 'inactive']);
    }

    public function suspended(): static
    {
        return $this->state(['status' => 'suspended']);
    }
}
