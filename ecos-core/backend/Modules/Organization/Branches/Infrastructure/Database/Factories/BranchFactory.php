<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Organization\Branches\Domain\Models\Branch;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * @extends Factory<Branch>
 */
final class BranchFactory extends Factory
{
    /**
     * @var class-string<Branch>
     */
    protected $model = Branch::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'code' => strtoupper($this->faker->unique()->bothify('BR-####')),
            'name' => $this->faker->city().' Branch',
            'phone' => $this->faker->phoneNumber(),
            'email' => $this->faker->companyEmail(),
            'manager_name' => $this->faker->name(),
            'address' => $this->faker->streetAddress(),
            'city' => $this->faker->city(),
            'country' => $this->faker->country(),
            'is_head_office' => false,
            'is_active' => $this->faker->boolean(85),
        ];
    }

    public function headOffice(): self
    {
        return $this->state(fn (): array => ['is_head_office' => true]);
    }
}
