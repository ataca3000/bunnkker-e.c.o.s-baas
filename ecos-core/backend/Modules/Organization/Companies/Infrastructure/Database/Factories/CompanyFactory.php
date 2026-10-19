<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * @extends Factory<Company>
 */
final class CompanyFactory extends Factory
{
    /**
     * @var class-string<Company>
     */
    protected $model = Company::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = $this->faker->unique()->company();

        return [
            'code' => strtoupper($this->faker->unique()->bothify('CMP-####')),
            'name' => $name,
            'legal_name' => $name.' LLC',
            'tax_number' => (string) $this->faker->numerify('##########'),
            'commercial_registration' => (string) $this->faker->numerify('CR-######'),
            'email' => $this->faker->companyEmail(),
            'phone' => $this->faker->phoneNumber(),
            'mobile' => $this->faker->phoneNumber(),
            'website' => $this->faker->url(),
            'currency' => $this->faker->randomElement(['EGP', 'USD', 'EUR', 'SAR']),
            'timezone' => 'Africa/Cairo',
            'country' => $this->faker->country(),
            'city' => $this->faker->city(),
            'address' => $this->faker->streetAddress(),
            'postal_code' => $this->faker->postcode(),
            'logo' => null,
            'is_active' => $this->faker->boolean(80),
        ];
    }
}
