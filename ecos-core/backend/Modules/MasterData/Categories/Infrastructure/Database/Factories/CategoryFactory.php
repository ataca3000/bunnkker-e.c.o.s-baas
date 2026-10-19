<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Infrastructure\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\MasterData\Categories\Domain\Models\Category;

/**
 * @extends Factory<Category>
 */
final class CategoryFactory extends Factory
{
    /**
     * @var class-string<Category>
     */
    protected $model = Category::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'parent_id' => null,
            'code' => strtoupper($this->faker->unique()->bothify('CAT-####')),
            'name' => ucfirst($this->faker->unique()->word()),
            'description' => $this->faker->sentence(),
            'level' => 1,
            'sort_order' => $this->faker->numberBetween(0, 50),
            'is_active' => true,
            'category_scope' => 'product',
        ];
    }

    /** State: creates a material-scoped category. */
    public function material(): static
    {
        return $this->state(['category_scope' => 'material']);
    }

    /** State: creates a product-scoped category (explicit, mirrors material()). */
    public function product(): static
    {
        return $this->state(['category_scope' => 'product']);
    }
}
