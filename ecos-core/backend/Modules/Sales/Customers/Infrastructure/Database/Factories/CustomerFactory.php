<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Sales\Customers\Domain\Models\Customer;
use Modules\Sales\Customers\Domain\Models\CustomerBrand;

/**
 * @extends Factory<Customer>
 */
final class CustomerFactory extends Factory
{
    /**
     * @var class-string<Customer>
     */
    protected $model = Customer::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            // company_id must be provided explicitly or via withCompany() / withBrands().
            'company_id'     => null,
            'code'           => strtoupper($this->faker->unique()->bothify('CUS-####')),
            'name'           => $this->faker->company(),
            'contact_person' => $this->faker->name(),
            'email'          => $this->faker->companyEmail(),
            'phone'          => $this->faker->phoneNumber(),
            'mobile'         => $this->faker->phoneNumber(),
            'country'        => $this->faker->country(),
            'city'           => $this->faker->city(),
            'address'        => $this->faker->streetAddress(),
            'notes'          => $this->faker->optional()->sentence(),
            'is_active'      => $this->faker->boolean(85),
        ];
    }

    /** Assign a specific company to the customer. */
    public function withCompany(string $companyId): static
    {
        return $this->state(['company_id' => $companyId]);
    }

    /**
     * Attach one or more brands to the customer after creation.
     * The first brand is marked is_primary = true.
     * This is the standard factory path for brand associations.
     */
    public function withBrands(string ...$brandIds): static
    {
        return $this->afterCreating(function (Customer $customer) use ($brandIds): void {
            foreach (array_values($brandIds) as $index => $brandId) {
                CustomerBrand::create([
                    'customer_id' => $customer->id,
                    'brand_id'    => $brandId,
                    'is_primary'  => $index === 0,
                    'status'      => 'active',
                ]);
            }
        });
    }
}
