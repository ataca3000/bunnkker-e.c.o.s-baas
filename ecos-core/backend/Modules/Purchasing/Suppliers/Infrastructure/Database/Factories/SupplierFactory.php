<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * @extends Factory<Supplier>
 */
final class SupplierFactory extends Factory
{
    /**
     * @var class-string<Supplier>
     */
    protected $model = Supplier::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => strtoupper($this->faker->unique()->bothify('SUP-####')),
            'name' => $this->faker->company(),
            'contact_person' => $this->faker->name(),
            'email' => $this->faker->companyEmail(),
            'phone' => $this->faker->phoneNumber(),
            'mobile' => $this->faker->phoneNumber(),
            'country' => $this->faker->country(),
            'city' => $this->faker->city(),
            'address' => $this->faker->streetAddress(),
            'notes' => $this->faker->optional()->sentence(),
            'is_active' => $this->faker->boolean(85),
        ];
    }
}
