<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Infrastructure\Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Core\UserPreferences\Domain\Enums\PreferenceCategory;
use Modules\Core\UserPreferences\Domain\Models\UserPreference;

/**
 * @extends Factory<UserPreference>
 */
final class UserPreferenceFactory extends Factory
{
    protected $model = UserPreference::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $category = $this->faker->randomElement(PreferenceCategory::cases())->value;

        return [
            'user_id' => User::factory(),
            'category' => $category,
            'payload' => PreferenceCategory::from($category)->defaultPayload() ?? [],
        ];
    }

    /**
     * Set a specific category for this factory state.
     */
    public function forCategory(PreferenceCategory $category): static
    {
        return $this->state([
            'category' => $category->value,
            'payload' => $category->defaultPayload() ?? [],
        ]);
    }
}
