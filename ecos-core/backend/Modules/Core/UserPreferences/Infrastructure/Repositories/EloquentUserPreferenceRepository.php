<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Infrastructure\Repositories;

use Illuminate\Support\Collection;
use Modules\Core\UserPreferences\Domain\Contracts\UserPreferenceRepositoryInterface;
use Modules\Core\UserPreferences\Domain\Models\UserPreference;

final class EloquentUserPreferenceRepository implements UserPreferenceRepositoryInterface
{
    /** @return Collection<string, UserPreference> */
    public function allForUser(int $userId): Collection
    {
        return UserPreference::query()
            ->where('user_id', $userId)
            ->orderBy('category')
            ->get()
            ->keyBy('category');
    }

    public function findByCategory(int $userId, string $category): ?UserPreference
    {
        return UserPreference::query()
            ->where('user_id', $userId)
            ->where('category', $category)
            ->first();
    }

    /** @param array<string, mixed> $payload */
    public function upsert(int $userId, string $category, array $payload): UserPreference
    {
        $preference = UserPreference::query()->firstOrNew([
            'user_id' => $userId,
            'category' => $category,
        ]);

        $preference->payload = $payload;
        $preference->save();

        return $preference->refresh();
    }

    public function deleteByCategory(int $userId, string $category): bool
    {
        return UserPreference::query()
            ->where('user_id', $userId)
            ->where('category', $category)
            ->delete() > 0;
    }

    public function deleteAllForUser(int $userId): int
    {
        return UserPreference::query()
            ->where('user_id', $userId)
            ->delete();
    }
}
