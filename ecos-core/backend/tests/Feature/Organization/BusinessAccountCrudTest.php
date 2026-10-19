<?php

declare(strict_types=1);

namespace Tests\Feature\Organization;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * WP-ORG-002 — Business Accounts Module
 *
 * Verifies:
 *  1.  GET  /business-accounts           returns paginated list
 *  2.  GET  /business-accounts           filter by company_id
 *  3.  GET  /business-accounts           filter by provider
 *  4.  GET  /business-accounts           filter by status
 *  5.  GET  /business-accounts           search by name
 *  6.  POST /business-accounts           creates with auto-generated BA-000001 code
 *  7.  POST /business-accounts           creates with explicit code
 *  8.  POST /business-accounts           validates required fields
 *  9.  POST /business-accounts           enforces unique code per company
 * 10.  GET  /business-accounts/{id}      returns single record
 * 11.  GET  /business-accounts/{id}      returns 404 for unknown id
 * 12.  PUT  /business-accounts/{id}      updates mutable fields
 * 13.  PUT  /business-accounts/{id}      cannot change company_id or code
 * 14.  DELETE /business-accounts/{id}    soft-deletes the record
 * 15.  Unauthenticated                   gets 401
 */
class BusinessAccountCrudTest extends TestCase
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
            'name' => 'Meta Business Suite',
            'provider' => 'Meta',
        ], $overrides);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_results(): void
    {
        BusinessAccount::factory()->count(3)->create(['company_id' => $this->company->id]);

        $this->auth()->getJson('/api/business-accounts')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 3);
    }

    public function test_index_filters_by_company_id(): void
    {
        $other = Company::factory()->create();
        BusinessAccount::factory()->create(['company_id' => $this->company->id, 'code' => 'BA-000001']);
        BusinessAccount::factory()->create(['company_id' => $other->id, 'code' => 'BA-000001']);

        $this->auth()->getJson('/api/business-accounts?company_id='.$this->company->id)
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);
    }

    public function test_index_filters_by_provider(): void
    {
        BusinessAccount::factory()->create(['company_id' => $this->company->id, 'provider' => 'Meta', 'code' => 'BA-000001']);
        BusinessAccount::factory()->create(['company_id' => $this->company->id, 'provider' => 'Shopify', 'code' => 'BA-000002']);

        $this->auth()->getJson('/api/business-accounts?provider=Meta')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);
    }

    public function test_index_filters_by_status(): void
    {
        BusinessAccount::factory()->create(['company_id' => $this->company->id, 'status' => 'active', 'code' => 'BA-000001']);
        BusinessAccount::factory()->inactive()->create(['company_id' => $this->company->id, 'code' => 'BA-000002']);

        $this->auth()->getJson('/api/business-accounts?status=active')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);

        $this->auth()->getJson('/api/business-accounts?status=inactive')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);
    }

    public function test_index_searches_by_name(): void
    {
        BusinessAccount::factory()->create(['company_id' => $this->company->id, 'name' => 'FindMe Account', 'code' => 'BA-000001']);
        BusinessAccount::factory()->create(['company_id' => $this->company->id, 'name' => 'Other Account', 'code' => 'BA-000002']);

        $this->auth()->getJson('/api/business-accounts?search=FindMe')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_store_generates_ba_000001_code(): void
    {
        $this->auth()->postJson('/api/business-accounts', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.code', 'BA-000001')
            ->assertJsonPath('data.name', 'Meta Business Suite');
    }

    public function test_store_uses_explicit_code(): void
    {
        $this->auth()->postJson('/api/business-accounts', $this->payload(['code' => 'BA-999999']))
            ->assertCreated()
            ->assertJsonPath('data.code', 'BA-999999');
    }

    public function test_store_validates_required_fields(): void
    {
        $this->auth()->postJson('/api/business-accounts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_id', 'name', 'provider']);
    }

    public function test_store_enforces_unique_code_per_company(): void
    {
        BusinessAccount::factory()->create(['company_id' => $this->company->id, 'code' => 'BA-000001']);

        $this->auth()->postJson('/api/business-accounts', $this->payload(['code' => 'BA-000001']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_show_returns_business_account(): void
    {
        $account = BusinessAccount::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->getJson("/api/business-accounts/{$account->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $account->id);
    }

    public function test_show_returns_404_for_unknown_id(): void
    {
        $this->auth()->getJson('/api/business-accounts/00000000-0000-0000-0000-000000000000')
            ->assertNotFound();
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function test_update_changes_mutable_fields(): void
    {
        $account = BusinessAccount::factory()->create([
            'company_id' => $this->company->id,
            'provider' => 'Meta',
        ]);

        $this->auth()->putJson("/api/business-accounts/{$account->id}", [
            'name' => 'Updated Name',
            'provider' => 'Shopify',
            'status' => 'inactive',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Updated Name')
            ->assertJsonPath('data.provider', 'Shopify')
            ->assertJsonPath('data.status', 'inactive');
    }

    public function test_update_does_not_change_company_id_or_code(): void
    {
        $account = BusinessAccount::factory()->create([
            'company_id' => $this->company->id,
            'code' => 'BA-000001',
        ]);
        $originalCode = $account->code;
        $originalCompanyId = $account->company_id;

        $this->auth()->putJson("/api/business-accounts/{$account->id}", [
            'name' => 'Some Name',
            'provider' => 'Meta',
        ])->assertOk();

        $account->refresh();
        $this->assertEquals($originalCode, $account->code);
        $this->assertEquals($originalCompanyId, $account->company_id);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function test_destroy_soft_deletes_record(): void
    {
        $account = BusinessAccount::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->deleteJson("/api/business-accounts/{$account->id}")
            ->assertOk();

        $this->assertSoftDeleted('business_accounts', ['id' => $account->id]);
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    public function test_unauthenticated_gets_401(): void
    {
        $this->getJson('/api/business-accounts')->assertUnauthorized();
    }
}
