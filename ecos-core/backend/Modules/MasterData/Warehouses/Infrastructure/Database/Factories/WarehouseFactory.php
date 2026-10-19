<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * @extends Factory<Warehouse>
 */
final class WarehouseFactory extends Factory
{
    /**
     * @var class-string<Warehouse>
     */
    protected $model = Warehouse::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'code' => strtoupper($this->faker->unique()->bothify('WH-####')),
            'name' => $this->faker->city().' Warehouse',
            'address' => $this->faker->streetAddress(),
            'city' => $this->faker->city(),
            'country' => $this->faker->country(),
            'is_active' => $this->faker->boolean(85),
        ];
    }
}
