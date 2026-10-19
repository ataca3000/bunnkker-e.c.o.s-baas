<?php

declare(strict_types=1);

namespace Tests\Feature\Core;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Core\UserPreferences\Domain\Enums\PreferenceCategory;
use Modules\Core\UserPreferences\Domain\Models\UserPreference;
use Tests\TestCase;

/**
 * TASK-ARCH-007 — User Preferences Foundation
 *
 * Verifies:
 *  1. GET  /me/preferences          returns all categories as flat map
 *  2. GET  /me/preferences/{cat}    returns single category payload
 *  3. GET  /me/preferences/{cat}    returns 404 when unset
 *  4. PUT  /me/preferences/{cat}    creates a new preference record
 *  5. PUT  /me/preferences/{cat}    fully replaces (not merges) existing record
 *  6. DELETE /me/preferences/{cat}  removes one category
 *  7. DELETE /me/preferences        removes all categories for the user
 *  8. PUT validates the category regex constraint
 *  9. PUT rejects non-object payloads (must be JSON object)
 * 10. One user's preferences are isolated from another user's
 * 11. PreferenceCategory enum covers known categories with default payloads
 * 12. UserPreferenceService can be resolved from the container
 */
class UserPreferenceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /me/preferences
    // ─────────────────────────────────────────────────────────────────────────

    public function test_index_returns_empty_map_when_no_preferences_set(): void
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/me/preferences');

        $response->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_index_returns_all_categories_as_flat_map(): void
    {
        UserPreference::factory()->create([
            'user_id' => $this->user->id,
            'category' => 'products',
            'payload' => ['density' => 'compact', 'page_size' => 50],
        ]);
        UserPreference::factory()->create([
            'user_id' => $this->user->id,
            'category' => 'theme',
            'payload' => ['theme' => 'dark', 'language' => 'ar'],
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/me/preferences');

        $response->assertOk()
            ->assertJsonPath('data.products.density', 'compact')
            ->assertJsonPath('data.products.page_size', 50)
            ->assertJsonPath('data.theme.theme', 'dark')
            ->assertJsonPath('data.theme.language', 'ar');
    }

    public function test_index_requires_authentication(): void
    {
        $this->getJson('/api/me/preferences')
            ->assertUnauthorized();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /me/preferences/{category}
    // ─────────────────────────────────────────────────────────────────────────

    public function test_show_returns_category_payload(): void
    {
        UserPreference::factory()->create([
            'user_id' => $this->user->id,
            'category' => 'products',
            'payload' => ['density' => 'comfortable', 'page_size' => 25],
        ]);

        $response = $this->actingAs($this->user)
            ->getJson('/api/me/preferences/products');

        $response->assertOk()
            ->assertJsonPath('data.category', 'products')
            ->assertJsonPath('data.payload.density', 'comfortable')
            ->assertJsonPath('data.payload.page_size', 25);
    }

    public function test_show_returns_404_when_category_not_set(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/me/preferences/orders')
            ->assertNotFound();
    }

    public function test_show_isolates_by_user(): void
    {
        $otherUser = User::factory()->create();
        UserPreference::factory()->create([
            'user_id' => $otherUser->id,
            'category' => 'products',
            'payload' => ['density' => 'compact'],
        ]);

        // Authenticated user has no products preference → should get 404.
        $this->actingAs($this->user)
            ->getJson('/api/me/preferences/products')
            ->assertNotFound();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /me/preferences/{category}
    // ─────────────────────────────────────────────────────────────────────────

    public function test_upsert_creates_new_preference_record(): void
    {
        $payload = ['density' => 'compact', 'page_size' => 100, 'columns' => ['sku' => true]];

        $response = $this->actingAs($this->user)
            ->putJson('/api/me/preferences/products', ['payload' => $payload]);

        $response->assertOk()
            ->assertJsonPath('data.category', 'products')
            ->assertJsonPath('data.payload.density', 'compact')
            ->assertJsonPath('data.payload.page_size', 100);

        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $this->user->id,
            'category' => 'products',
        ]);
    }

    public function test_upsert_fully_replaces_existing_payload(): void
    {
        // Seed an existing record with more fields.
        UserPreference::factory()->create([
            'user_id' => $this->user->id,
            'category' => 'products',
            'payload' => ['density' => 'compact', 'page_size' => 50, 'sort' => ['field' => 'name', 'direction' => 'asc']],
        ]);

        // Replace with a payload that omits 'sort'.
        $this->actingAs($this->user)
            ->putJson('/api/me/preferences/products', [
                'payload' => ['density' => 'comfortable', 'page_size' => 25],
            ])
            ->assertOk()
            ->assertJsonPath('data.payload.density', 'comfortable')
            ->assertJsonMissingPath('data.payload.sort'); // old key removed

        // Verify only one record exists (upsert, not insert).
        $this->assertDatabaseCount('user_preferences', 1);
    }

    public function test_upsert_creates_isolated_records_per_category(): void
    {
        $this->actingAs($this->user)->putJson('/api/me/preferences/products', ['payload' => ['density' => 'compact']]);
        $this->actingAs($this->user)->putJson('/api/me/preferences/orders', ['payload' => ['page_size' => 50]]);

        $this->assertDatabaseCount('user_preferences', 2);
    }

    public function test_upsert_requires_payload_to_be_an_object(): void
    {
        $this->actingAs($this->user)
            ->putJson('/api/me/preferences/products', ['payload' => 'not-an-object'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payload']);
    }

    public function test_upsert_rejects_empty_payload_field(): void
    {
        $this->actingAs($this->user)
            ->putJson('/api/me/preferences/products', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['payload']);
    }

    public function test_upsert_requires_authentication(): void
    {
        $this->putJson('/api/me/preferences/products', ['payload' => []])
            ->assertUnauthorized();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /me/preferences/{category}
    // ─────────────────────────────────────────────────────────────────────────

    public function test_reset_category_removes_specific_category(): void
    {
        UserPreference::factory()->create([
            'user_id' => $this->user->id,
            'category' => 'products',
            'payload' => ['density' => 'compact'],
        ]);
        UserPreference::factory()->create([
            'user_id' => $this->user->id,
            'category' => 'theme',
            'payload' => ['theme' => 'dark'],
        ]);

        $this->actingAs($this->user)
            ->deleteJson('/api/me/preferences/products')
            ->assertOk();

        $this->assertDatabaseMissing('user_preferences', [
            'user_id' => $this->user->id,
            'category' => 'products',
        ]);

        // Other categories must remain untouched.
        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $this->user->id,
            'category' => 'theme',
        ]);
    }

    public function test_reset_category_succeeds_even_when_no_record_exists(): void
    {
        // Idempotent: deleting a non-existent category should not error.
        $this->actingAs($this->user)
            ->deleteJson('/api/me/preferences/orders')
            ->assertOk();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE /me/preferences
    // ─────────────────────────────────────────────────────────────────────────

    public function test_reset_all_removes_all_categories_for_authenticated_user(): void
    {
        UserPreference::factory()->count(3)->create(['user_id' => $this->user->id]);

        $this->actingAs($this->user)
            ->deleteJson('/api/me/preferences')
            ->assertOk();

        $this->assertDatabaseCount('user_preferences', 0);
    }

    public function test_reset_all_only_removes_authenticated_users_records(): void
    {
        $otherUser = User::factory()->create();
        UserPreference::factory()->create([
            'user_id' => $this->user->id,
            'category' => 'products',
            'payload' => [],
        ]);
        UserPreference::factory()->create([
            'user_id' => $otherUser->id,
            'category' => 'theme',
            'payload' => [],
        ]);

        $this->actingAs($this->user)
            ->deleteJson('/api/me/preferences')
            ->assertOk();

        // Other user's preferences must remain.
        $this->assertDatabaseHas('user_preferences', [
            'user_id' => $otherUser->id,
            'category' => 'theme',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Category validation (route constraint)
    // ─────────────────────────────────────────────────────────────────────────

    public function test_invalid_category_slug_returns_404(): void
    {
        // Route constraint `[a-z][a-z0-9._-]{0,149}` rejects uppercase, spaces, etc.
        $this->actingAs($this->user)
            ->getJson('/api/me/preferences/PRODUCTS')
            ->assertNotFound();

        $this->actingAs($this->user)
            ->getJson('/api/me/preferences/my%20category')
            ->assertNotFound();
    }

    public function test_valid_dot_namespaced_category_is_accepted(): void
    {
        $this->actingAs($this->user)
            ->putJson('/api/me/preferences/reports.sales', ['payload' => ['page_size' => 10]])
            ->assertOk()
            ->assertJsonPath('data.category', 'reports.sales');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PreferenceCategory enum
    // ─────────────────────────────────────────────────────────────────────────

    public function test_all_known_categories_have_non_null_default_payloads(): void
    {
        foreach (PreferenceCategory::cases() as $category) {
            $payload = $category->defaultPayload();
            $this->assertIsArray(
                $payload,
                "PreferenceCategory::{$category->name} must return an array from defaultPayload()",
            );
        }
    }

    public function test_table_category_defaults_include_required_table_keys(): void
    {
        $defaults = PreferenceCategory::Products->defaultPayload();

        $this->assertIsArray($defaults);
        $this->assertArrayHasKey('columns', $defaults);
        $this->assertArrayHasKey('column_order', $defaults);
        $this->assertArrayHasKey('column_widths', $defaults);
        $this->assertArrayHasKey('density', $defaults);
        $this->assertArrayHasKey('sort', $defaults);
        $this->assertArrayHasKey('page_size', $defaults);
        $this->assertArrayHasKey('filter_presets', $defaults);
    }

    public function test_theme_category_defaults_include_required_keys(): void
    {
        $defaults = PreferenceCategory::Theme->defaultPayload();

        $this->assertIsArray($defaults);
        $this->assertArrayHasKey('theme', $defaults);
        $this->assertArrayHasKey('language', $defaults);
        $this->assertArrayHasKey('timezone', $defaults);
    }

    public function test_workspace_category_defaults_include_required_keys(): void
    {
        $defaults = PreferenceCategory::Workspace->defaultPayload();

        $this->assertIsArray($defaults);
        $this->assertArrayHasKey('default_company', $defaults);
        $this->assertArrayHasKey('default_branch', $defaults);
        $this->assertArrayHasKey('default_warehouse', $defaults);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Service container resolution
    // ─────────────────────────────────────────────────────────────────────────

    public function test_user_preference_service_resolves_from_container(): void
    {
        $service = app(\Modules\Core\UserPreferences\Application\Services\UserPreferenceService::class);

        $this->assertInstanceOf(
            \Modules\Core\UserPreferences\Application\Services\UserPreferenceService::class,
            $service,
        );
    }
}
