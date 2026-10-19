<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Domain\Contracts;

use Illuminate\Support\Collection;
use Modules\Core\UserPreferences\Domain\Models\UserPreference;

/**
 * Port (anti-corruption layer) between the application layer and the
 * persistence implementation.
 *
 * All methods are keyed by `userId` (the integer PK of `App\Models\User`)
 * and a `category` string.
 */
interface UserPreferenceRepositoryInterface
{
    /**
     * Return all preference records for the given user, keyed by category.
     *
     * @return Collection<string, UserPreference>
     */
    public function allForUser(int $userId): Collection;

    /**
     * Return the preference record for a specific (user, category) pair,
     * or null if no record exists yet.
     */
    public function findByCategory(int $userId, string $category): ?UserPreference;

    /**
     * Create or fully replace the preference payload for a (user, category) pair.
     *
     * @param  array<string, mixed>  $payload
     */
    public function upsert(int $userId, string $category, array $payload): UserPreference;

    /**
     * Delete the preference record for a specific (user, category) pair.
     * Returns true if a record was deleted, false if none existed.
     */
    public function deleteByCategory(int $userId, string $category): bool;

    /**
     * Delete ALL preference records for the given user.
     *
     * @return int number of rows deleted
     */
    public function deleteAllForUser(int $userId): int;
}
