<?php

declare(strict_types=1);

namespace Modules\Core\UserPreferences\Application\Services;

use Illuminate\Support\Collection;
use Modules\Core\UserPreferences\Domain\Contracts\UserPreferenceRepositoryInterface;
use Modules\Core\UserPreferences\Domain\Models\UserPreference;

/**
 * Central orchestrator for user preference persistence.
 *
 * Framework-agnostic: only depends on the repository port and domain models.
 * No HTTP, no Eloquent, no queue knowledge here.
 *
 * Consumed by:
 *   UserPreferenceController (HTTP presentation layer)
 *
 * Future consumers (Phase 2 migration):
 *   Products, Orders, Customers, Suppliers, Inventory, Purchasing,
 *   Manufacturing, Dashboard, Reports — any module needing user-scoped state.
 *
 * Preference semantics:
 *   - GET   returns null when no record exists (caller decides the default)
 *   - PUT   is a FULL REPLACE of the category payload (not a merge)
 *   - RESET deletes the record; the frontend falls back to its hard-coded defaults
 */
final class UserPreferenceService
{
    public function __construct(
        private readonly UserPreferenceRepositoryInterface $preferences,
    ) {}

    // ── Read ──────────────────────────────────────────────────────────────────

    /**
     * Return all preference records for a user, keyed by category name.
     *
     * @return Collection<string, UserPreference>
     */
    public function getAll(int $userId): Collection
    {
        return $this->preferences->allForUser($userId);
    }

    /**
     * Return the preference record for one category, or null if unset.
     */
    public function getByCategory(int $userId, string $category): ?UserPreference
    {
        return $this->preferences->findByCategory($userId, $category);
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    /**
     * Create or fully replace the preference payload for one category.
     *
     * @param  array<string, mixed>  $payload
     */
    public function upsert(int $userId, string $category, array $payload): UserPreference
    {
        return $this->preferences->upsert($userId, $category, $payload);
    }

    // ── Delete / Reset ────────────────────────────────────────────────────────

    /**
     * Remove the preference record for one category.
     *
     * After deletion the frontend reverts to its hard-coded defaults.
     * This is intentional: the service has no knowledge of per-module defaults.
     *
     * @return bool true if a record was deleted
     */
    public function resetCategory(int $userId, string $category): bool
    {
        return $this->preferences->deleteByCategory($userId, $category);
    }

    /**
     * Remove ALL preference records for a user.
     *
     * @return int number of rows deleted
     */
    public function resetAll(int $userId): int
    {
        return $this->preferences->deleteAllForUser($userId);
    }
}
