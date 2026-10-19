<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\MasterData\Units\Domain\Models\Unit;

/**
 * @extends Factory<Unit>
 */
final class UnitFactory extends Factory
{
    /**
     * @var class-string<Unit>
     */
    protected $model = Unit::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $word = $this->faker->unique()->word();

        return [
            'code' => strtoupper($this->faker->unique()->lexify('???')),
            'name' => ucfirst($word),
            'symbol' => strtoupper(substr($word, 0, 3)),
            'description' => $this->faker->sentence(),
            'is_active' => true,
        ];
    }
}
