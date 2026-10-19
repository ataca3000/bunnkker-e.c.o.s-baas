<?php

declare(strict_types=1);

namespace Tests\Feature\Organization;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Organization\Teams\Domain\Models\Team;
use Tests\TestCase;

/**
 * WP-ORG-002 — Teams Module
 *
 * Verifies:
 *  1.  GET  /teams           returns paginated list
 *  2.  POST /teams           creates with auto-generated TM-000001 code
 *  3.  POST /teams           validates required fields
 *  4.  GET  /teams/{id}      returns single record
 *  5.  GET  /teams/{id}      returns 404 for unknown id
 *  6.  PUT  /teams/{id}      updates mutable fields
 *  7.  DELETE /teams/{id}    soft-deletes the record
 *  8.  Unauthenticated       gets 401
 */
class TeamCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->company = Company::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'company_id' => $this->company->id,
            'name' => 'Sales Team Alpha',
        ], $overrides);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_results(): void
    {
        Team::factory()->count(3)->create(['company_id' => $this->company->id]);

        $this->auth()->getJson('/api/teams')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 3);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_store_generates_tm_000001_code(): void
    {
        $this->auth()->postJson('/api/teams', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.code', 'TM-000001')
            ->assertJsonPath('data.name', 'Sales Team Alpha');
    }

    public function test_store_validates_required_fields(): void
    {
        $this->auth()->postJson('/api/teams', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_id', 'name']);
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_show_returns_team(): void
    {
        $team = Team::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->getJson("/api/teams/{$team->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $team->id);
    }

    public function test_show_returns_404_for_unknown_id(): void
    {
        $this->auth()->getJson('/api/teams/00000000-0000-0000-0000-000000000000')
            ->assertNotFound();
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function test_update_changes_mutable_fields(): void
    {
        $team = Team::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->putJson("/api/teams/{$team->id}", [
            'name' => 'Delivery Team Beta',
            'leader_name' => 'Jane Doe',
            'is_active' => false,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Delivery Team Beta')
            ->assertJsonPath('data.leader_name', 'Jane Doe')
            ->assertJsonPath('data.is_active', false);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function test_destroy_soft_deletes_record(): void
    {
        $team = Team::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->deleteJson("/api/teams/{$team->id}")
            ->assertOk();

        $this->assertSoftDeleted('teams', ['id' => $team->id]);
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    public function test_unauthenticated_gets_401(): void
    {
        $this->getJson('/api/teams')->assertUnauthorized();
    }
}
