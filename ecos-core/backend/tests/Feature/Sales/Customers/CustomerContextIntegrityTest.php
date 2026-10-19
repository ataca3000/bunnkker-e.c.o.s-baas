<?php

declare(strict_types=1);

namespace Tests\Feature\Sales\Customers;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Modules\Sales\Customers\Domain\Models\CustomerBrand;
use Tests\TestCase;

/**
 * TASK-CUSTOMER-BRAND-RELATIONSHIP-001 — Customer ↔ Brand Many-to-Many Architecture
 *
 * Verifies the approved architecture: a Customer belongs to one Company
 * and may have independent relationships with many Brands via customer_brands.
 *
 *   §1 CREATE
 *    1.  company_id is stored server-side from auth user
 *    2.  brand_id creates a customer_brands pivot record (not a customers column)
 *    3.  missing brand_id → 422 validation error
 *    4.  brand from a different company → 422 validation error
 *    5.  user with no company context → 422 error
 *
 *   §2 PIVOT
 *    6.  customers table has no brand_id column
 *    7.  a customer can be associated with multiple brands
 *    8.  unique constraint rejects duplicate customer-brand pairs
 *    9.  force delete cascades to customer_brands
 *
 *   §3 UPDATE
 *   10.  company_id is preserved (immutable after creation)
 *   11.  brand_id sent on update is silently ignored — pivot unchanged
 *
 *   §4 READ / FILTERING
 *   12.  index returns only customers belonging to the user's company
 *   13.  index filters by brand_id via pivot join
 *   14.  a multi-brand customer appears in filters for each of its brands
 *
 *   §5 RESOURCE
 *   15.  show endpoint exposes brands[] array, not a top-level brand_id
 *   16.  index items expose brands[] array
 *
 *   §6 REGRESSION
 *   17.  soft delete still works
 *   18.  search filter still works
 *   19.  status filter still works
 */
final class CustomerContextIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private Company $company;

    private Brand $brand;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create(['is_active' => true]);
        $this->brand   = Brand::factory()->create([
            'company_id' => $this->company->id,
            'is_active'  => true,
        ]);
        $this->user = User::factory()->create([
            'company_id' => $this->company->id,
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    private function storePayload(array $overrides = []): array
    {
        return array_merge([
            'brand_id' => $this->brand->id,
            'code'     => 'CUS-TEST-' . uniqid(),
            'name'     => 'Test Customer',
        ], $overrides);
    }

    private function updatePayload(Customer $customer, array $overrides = []): array
    {
        return array_merge([
            'code' => $customer->code,
            'name' => $customer->name,
        ], $overrides);
    }

    private function makeCustomer(array $overrides = []): Customer
    {
        return Customer::factory()
            ->withCompany($this->company->id)
            ->withBrands($this->brand->id)
            ->create($overrides);
    }

    // ── §1 CREATE — company_id server-side; brand_id creates pivot ────────

    /** @test */
    public function create_stores_company_id_from_authenticated_user(): void
    {
        $this->auth()->postJson('/api/customers', $this->storePayload(['code' => 'CUS-CO-001']))
            ->assertStatus(201);

        $this->assertDatabaseHas('customers', [
            'code'       => 'CUS-CO-001',
            'company_id' => $this->company->id,
        ]);
    }

    /** @test */
    public function create_creates_customer_brand_pivot_record(): void
    {
        $response = $this->auth()->postJson('/api/customers', $this->storePayload([
            'code'     => 'CUS-BR-001',
            'brand_id' => $this->brand->id,
        ]));

        $response->assertStatus(201);

        $customerId = $response->json('data.id');

        $this->assertDatabaseHas('customer_brands', [
            'customer_id' => $customerId,
            'brand_id'    => $this->brand->id,
            'is_primary'  => true,
            'status'      => 'active',
        ]);
    }

    /** @test */
    public function create_fails_when_brand_id_is_missing(): void
    {
        $this->auth()->postJson('/api/customers', [
            'code' => 'CUS-NOBR-001',
            'name' => 'No Brand Customer',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['brand_id']);

        $this->assertDatabaseMissing('customers', ['code' => 'CUS-NOBR-001']);
    }

    /** @test */
    public function create_fails_when_brand_belongs_to_a_different_company(): void
    {
        $otherCompany = Company::factory()->create();
        $otherBrand   = Brand::factory()->create(['company_id' => $otherCompany->id]);

        $this->auth()->postJson('/api/customers', $this->storePayload([
            'code'     => 'CUS-XBRAND-001',
            'brand_id' => $otherBrand->id,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['brand_id']);
    }

    /** @test */
    public function create_fails_when_user_has_no_company_context(): void
    {
        $userWithoutCompany = User::factory()->create(['company_id' => null]);

        $this->actingAs($userWithoutCompany)->postJson('/api/customers', [
            'code'     => 'CUS-NOCO-001',
            'name'     => 'No Company Customer',
            'brand_id' => $this->brand->id,
        ])->assertStatus(422);

        $this->assertDatabaseMissing('customers', ['code' => 'CUS-NOCO-001']);
    }

    // ── §2 PIVOT — structure and constraints ──────────────────────────────

    /** @test */
    public function customers_table_does_not_have_brand_id_column(): void
    {
        $this->assertFalse(
            Schema::hasColumn('customers', 'brand_id'),
            'brand_id must not exist on the customers table — brand associations live in customer_brands.',
        );
    }

    /** @test */
    public function customer_can_be_associated_with_multiple_brands(): void
    {
        $brandB = Brand::factory()->create([
            'company_id' => $this->company->id,
            'is_active'  => true,
        ]);

        $customer = Customer::factory()
            ->withCompany($this->company->id)
            ->withBrands($this->brand->id, $brandB->id)
            ->create();

        $this->assertDatabaseCount('customer_brands', 2);
        $this->assertDatabaseHas('customer_brands', ['customer_id' => $customer->id, 'brand_id' => $this->brand->id]);
        $this->assertDatabaseHas('customer_brands', ['customer_id' => $customer->id, 'brand_id' => $brandB->id]);

        $this->assertEquals(2, $customer->fresh()->customerBrands()->count());
    }

    /** @test */
    public function customer_brand_unique_constraint_rejects_duplicates(): void
    {
        $customer = Customer::factory()->withCompany($this->company->id)->create();

        CustomerBrand::create([
            'customer_id' => $customer->id,
            'brand_id'    => $this->brand->id,
            'is_primary'  => true,
            'status'      => 'active',
        ]);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);

        CustomerBrand::create([
            'customer_id' => $customer->id,
            'brand_id'    => $this->brand->id,
            'is_primary'  => false,
            'status'      => 'active',
        ]);
    }

    /** @test */
    public function force_delete_cascades_to_customer_brands(): void
    {
        $customer = $this->makeCustomer();

        $this->assertDatabaseHas('customer_brands', ['customer_id' => $customer->id]);

        $customer->forceDelete();

        $this->assertDatabaseMissing('customer_brands', ['customer_id' => $customer->id]);
    }

    // ── §3 UPDATE — company preserved; brand not modified ─────────────────

    /** @test */
    public function update_preserves_company_id(): void
    {
        $customer = $this->makeCustomer(['code' => 'CUS-UPD-CO-001', 'name' => 'Original']);

        $this->auth()->putJson("/api/customers/{$customer->id}", $this->updatePayload($customer, [
            'name' => 'Updated Name',
        ]))->assertStatus(200);

        $this->assertDatabaseHas('customers', [
            'id'         => $customer->id,
            'company_id' => $this->company->id,
            'name'       => 'Updated Name',
        ]);
    }

    /** @test */
    public function update_ignores_brand_id_and_does_not_modify_pivot(): void
    {
        $secondBrand = Brand::factory()->create([
            'company_id' => $this->company->id,
            'is_active'  => true,
        ]);
        $customer = $this->makeCustomer(['code' => 'CUS-UPD-BR-001']);

        // Send brand_id pointing to a different brand — must be silently ignored.
        $this->auth()->putJson("/api/customers/{$customer->id}", $this->updatePayload($customer, [
            'brand_id' => $secondBrand->id,
        ]))->assertStatus(200);

        // Pivot must still have only the original brand.
        $this->assertDatabaseCount('customer_brands', 1);
        $this->assertDatabaseHas('customer_brands', [
            'customer_id' => $customer->id,
            'brand_id'    => $this->brand->id,
        ]);
        $this->assertDatabaseMissing('customer_brands', [
            'customer_id' => $customer->id,
            'brand_id'    => $secondBrand->id,
        ]);
    }

    // ── §4 READ / FILTERING ───────────────────────────────────────────────

    /** @test */
    public function index_returns_only_customers_belonging_to_authenticated_users_company(): void
    {
        $otherCompany = Company::factory()->create();
        $otherBrand   = Brand::factory()->create(['company_id' => $otherCompany->id]);

        Customer::factory()->withCompany($this->company->id)->withBrands($this->brand->id)->count(3)->create();
        Customer::factory()->withCompany($otherCompany->id)->withBrands($otherBrand->id)->count(5)->create();

        $response = $this->auth()->getJson('/api/customers');

        $response->assertStatus(200);
        $this->assertEquals(3, $response->json('data.meta.total'));
    }

    /** @test */
    public function index_filters_by_brand_id_via_pivot(): void
    {
        $brandB = Brand::factory()->create([
            'company_id' => $this->company->id,
            'is_active'  => true,
        ]);

        Customer::factory()->withCompany($this->company->id)->withBrands($this->brand->id)->count(4)->create();
        Customer::factory()->withCompany($this->company->id)->withBrands($brandB->id)->count(2)->create();

        $response = $this->auth()->getJson("/api/customers?brand_id={$brandB->id}");

        $response->assertStatus(200);
        $this->assertEquals(2, $response->json('data.meta.total'));
    }

    /** @test */
    public function multi_brand_customer_appears_in_filters_for_each_brand(): void
    {
        $brandB = Brand::factory()->create([
            'company_id' => $this->company->id,
            'is_active'  => true,
        ]);

        // One customer belongs to both brands.
        Customer::factory()
            ->withCompany($this->company->id)
            ->withBrands($this->brand->id, $brandB->id)
            ->create(['name' => 'Multi-Brand Customer']);

        $responseA = $this->auth()->getJson("/api/customers?brand_id={$this->brand->id}");
        $responseB = $this->auth()->getJson("/api/customers?brand_id={$brandB->id}");

        $this->assertEquals(1, $responseA->json('data.meta.total'));
        $this->assertEquals(1, $responseB->json('data.meta.total'));
        $this->assertEquals('Multi-Brand Customer', $responseA->json('data.items.0.name'));
        $this->assertEquals('Multi-Brand Customer', $responseB->json('data.items.0.name'));
    }

    // ── §5 RESOURCE — brands[] not brand_id ───────────────────────────────

    /** @test */
    public function show_exposes_brands_array_not_top_level_brand_id(): void
    {
        $customer = $this->makeCustomer();

        $response = $this->auth()->getJson("/api/customers/{$customer->id}");

        $response->assertStatus(200)
            ->assertJsonPath('data.company_id', $this->company->id)
            ->assertJsonMissingPath('data.brand_id')
            ->assertJsonPath('data.brands.0.brand_id', $this->brand->id)
            ->assertJsonPath('data.brands.0.is_primary', true);
    }

    /** @test */
    public function index_items_expose_brands_array(): void
    {
        $this->makeCustomer();

        $response = $this->auth()->getJson('/api/customers');

        $response->assertStatus(200);

        $firstItem = $response->json('data.items.0');
        $this->assertEquals($this->company->id, $firstItem['company_id']);
        $this->assertArrayNotHasKey('brand_id', $firstItem);
        $this->assertArrayHasKey('brands', $firstItem);
        $this->assertEquals($this->brand->id, $firstItem['brands'][0]['brand_id']);
    }

    // ── §6 REGRESSION ─────────────────────────────────────────────────────

    /** @test */
    public function delete_still_works(): void
    {
        $customer = $this->makeCustomer();

        $this->auth()->deleteJson("/api/customers/{$customer->id}")
            ->assertStatus(200);

        $this->assertSoftDeleted('customers', ['id' => $customer->id]);
    }

    /** @test */
    public function search_filter_still_works(): void
    {
        $this->makeCustomer(['name' => 'Nile Distribution']);
        $this->makeCustomer(['name' => 'Cairo Retail']);

        $response = $this->auth()->getJson('/api/customers?search=Nile');

        $response->assertStatus(200);
        $this->assertEquals(1, $response->json('data.meta.total'));
        $this->assertEquals('Nile Distribution', $response->json('data.items.0.name'));
    }

    /** @test */
    public function status_filter_still_works(): void
    {
        $this->makeCustomer(['is_active' => true]);
        $this->makeCustomer(['is_active' => true]);
        $this->makeCustomer(['is_active' => false]);

        $response = $this->auth()->getJson('/api/customers?status=active');

        $response->assertStatus(200);
        $this->assertEquals(2, $response->json('data.meta.total'));
    }
}
