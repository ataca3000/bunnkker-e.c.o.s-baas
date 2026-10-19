<?php

declare(strict_types=1);

namespace Tests\Feature\Organization;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * WP-ORG-001 — Brand Module
 *
 * Verifies:
 *  1.  GET  /brands                  returns paginated list
 *  2.  GET  /brands                  search filters by code/name
 *  3.  GET  /brands                  company_id filter works
 *  4.  GET  /brands                  status filter active/inactive
 *  5.  POST /brands                  creates brand with auto code
 *  6.  POST /brands                  creates brand with manual code
 *  7.  POST /brands                  auto-generates slug from name
 *  8.  POST /brands                  accepts explicit slug
 *  9.  POST /brands                  rejects duplicate code within company
 * 10.  POST /brands                  rejects duplicate slug within company
 * 11.  POST /brands                  requires company_id
 * 12.  POST /brands                  requires name
 * 13.  GET  /brands/{id}             returns single brand
 * 14.  GET  /brands/{id}             returns 404 for missing brand
 * 15.  PUT  /brands/{id}             updates brand fields
 * 16.  PUT  /brands/{id}             returns 404 for missing brand
 * 17.  DELETE /brands/{id}           soft-deletes brand
 * 18.  DELETE /brands/{id}           returns 404 for missing brand
 * 19.  Sequential codes              BRD-000001, BRD-000002 per company
 * 20.  Company isolation             code sequence is per-company
 */
class BrandCrudTest extends TestCase
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

    private function brandPayload(array $overrides = []): array
    {
        return array_merge([
            'company_id' => $this->company->id,
            'name' => 'Acme Brand',
            'is_active' => true,
        ], $overrides);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_list(): void
    {
        Brand::factory()->count(3)->create(['company_id' => $this->company->id]);

        $this->auth()->getJson('/api/brands')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 3);
    }

    public function test_index_search_filters_by_name_and_code(): void
    {
        Brand::factory()->create(['company_id' => $this->company->id, 'name' => 'MatchMe', 'code' => 'BRD-000001', 'slug' => 'matchme']);
        Brand::factory()->create(['company_id' => $this->company->id, 'name' => 'Other', 'code' => 'BRD-000002', 'slug' => 'other']);

        $this->auth()->getJson('/api/brands?search=MatchMe')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);
    }

    public function test_index_company_filter(): void
    {
        $other = Company::factory()->create();
        Brand::factory()->create(['company_id' => $this->company->id, 'code' => 'BRD-000001', 'slug' => 'brand-a']);
        Brand::factory()->create(['company_id' => $other->id, 'code' => 'BRD-000001', 'slug' => 'brand-b']);

        $this->auth()->getJson('/api/brands?company_id='.$this->company->id)
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);
    }

    public function test_index_status_filter(): void
    {
        Brand::factory()->create(['company_id' => $this->company->id, 'is_active' => true, 'code' => 'BRD-000001', 'slug' => 'active-brand']);
        Brand::factory()->inactive()->create(['company_id' => $this->company->id, 'code' => 'BRD-000002', 'slug' => 'inactive-brand']);

        $this->auth()->getJson('/api/brands?status=active')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);

        $this->auth()->getJson('/api/brands?status=inactive')
            ->assertOk()
            ->assertJsonPath('data.meta.total', 1);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_store_creates_brand_with_auto_code(): void
    {
        $this->auth()->postJson('/api/brands', $this->brandPayload())
            ->assertCreated()
            ->assertJsonPath('data.code', 'BRD-000001')
            ->assertJsonPath('data.name', 'Acme Brand');
    }

    public function test_store_creates_brand_with_manual_code(): void
    {
        $this->auth()->postJson('/api/brands', $this->brandPayload(['code' => 'BRD-999999']))
            ->assertCreated()
            ->assertJsonPath('data.code', 'BRD-999999');
    }

    public function test_store_auto_generates_slug_from_name(): void
    {
        $this->auth()->postJson('/api/brands', $this->brandPayload(['name' => 'Hello World Brand']))
            ->assertCreated()
            ->assertJsonPath('data.slug', 'hello-world-brand');
    }

    public function test_store_accepts_explicit_slug(): void
    {
        $this->auth()->postJson('/api/brands', $this->brandPayload(['slug' => 'custom-slug']))
            ->assertCreated()
            ->assertJsonPath('data.slug', 'custom-slug');
    }

    public function test_store_rejects_duplicate_code_within_company(): void
    {
        Brand::factory()->create(['company_id' => $this->company->id, 'code' => 'BRD-000001', 'slug' => 'brand-1']);

        $this->auth()->postJson('/api/brands', $this->brandPayload(['code' => 'BRD-000001']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['code']);
    }

    public function test_store_rejects_duplicate_slug_within_company(): void
    {
        Brand::factory()->create(['company_id' => $this->company->id, 'code' => 'BRD-000001', 'slug' => 'acme-brand']);

        $this->auth()->postJson('/api/brands', $this->brandPayload(['slug' => 'acme-brand']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);
    }

    public function test_store_requires_company_id(): void
    {
        $payload = $this->brandPayload();
        unset($payload['company_id']);

        $this->auth()->postJson('/api/brands', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company_id']);
    }

    public function test_store_requires_name(): void
    {
        $payload = $this->brandPayload();
        unset($payload['name']);

        $this->auth()->postJson('/api/brands', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_show_returns_single_brand(): void
    {
        $brand = Brand::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->getJson("/api/brands/{$brand->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $brand->id);
    }

    public function test_show_returns_404_for_missing_brand(): void
    {
        $this->auth()->getJson('/api/brands/00000000-0000-0000-0000-000000000000')
            ->assertNotFound();
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public function test_update_modifies_brand_fields(): void
    {
        $brand = Brand::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->putJson("/api/brands/{$brand->id}", [
            'name' => 'New Name',
            'description' => 'Updated desc',
            'is_active' => false,
        ])->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.is_active', false);
    }

    public function test_update_returns_404_for_missing_brand(): void
    {
        $this->auth()->putJson('/api/brands/00000000-0000-0000-0000-000000000000', [
            'name' => 'X',
        ])->assertNotFound();
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    public function test_destroy_soft_deletes_brand(): void
    {
        $brand = Brand::factory()->create(['company_id' => $this->company->id]);

        $this->auth()->deleteJson("/api/brands/{$brand->id}")
            ->assertOk();

        $this->assertSoftDeleted('brands', ['id' => $brand->id]);
    }

    public function test_destroy_returns_404_for_missing_brand(): void
    {
        $this->auth()->deleteJson('/api/brands/00000000-0000-0000-0000-000000000000')
            ->assertNotFound();
    }

    // ── Auto Code ────────────────────────────────────────────────────────────

    public function test_sequential_codes_increment_per_company(): void
    {
        $first = $this->auth()->postJson('/api/brands', $this->brandPayload(['name' => 'First']))
            ->assertCreated()
            ->json('data.code');

        $second = $this->auth()->postJson('/api/brands', $this->brandPayload(['name' => 'Second']))
            ->assertCreated()
            ->json('data.code');

        $this->assertEquals('BRD-000001', $first);
        $this->assertEquals('BRD-000002', $second);
    }

    public function test_code_sequence_is_per_company(): void
    {
        $other = Company::factory()->create();

        $this->auth()->postJson('/api/brands', $this->brandPayload(['name' => 'CompanyA Brand']))
            ->assertCreated()
            ->assertJsonPath('data.code', 'BRD-000001');

        $this->auth()->postJson('/api/brands', array_merge($this->brandPayload(), [
            'company_id' => $other->id,
            'name' => 'CompanyB Brand',
        ]))->assertCreated()
            ->assertJsonPath('data.code', 'BRD-000001');
    }
}
