<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Organization\Teams\Domain\Models\Team;

/**
 * @extends Factory<Team>
 */
final class TeamFactory extends Factory
{
    protected $model = Team::class;

    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'code' => 'TM-'.str_pad((string) $this->faker->unique()->numberBetween(1, 999999), 6, '0', STR_PAD_LEFT),
            'name' => $this->faker->words(3, true).' Team',
            'leader_name' => $this->faker->optional()->name(),
            'description' => $this->faker->optional()->sentence(),
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
