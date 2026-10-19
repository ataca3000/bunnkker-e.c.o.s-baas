<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Tests\TestCase;

/**
 * Covers customer creation rules:
 *   - Happy path: create a customer successfully.
 *   - Duplicate phone rejection: same phone in same company.
 *   - Same customer name allowed with different phones.
 *   - Same phone allowed across different companies.
 *   - Brand loads automatically from company context (auth/me returns company_id).
 */
final class CustomerCreationTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private string $companyId;
    private string $brandId;

    protected function setUp(): void
    {
        parent::setUp();

        // Company must exist before User (FK constraint on users.company_id).
        $company         = Company::factory()->create();
        $this->companyId = (string) $company->id;

        $this->user = User::factory()->create(['company_id' => $this->companyId]);

        $brand          = Brand::factory()->create(['company_id' => $this->companyId, 'is_active' => true]);
        $this->brandId  = (string) $brand->id;

        $this->actingAs($this->user);
    }

    // ── Auth/me returns company_id ─────────────────────────────────────────────

    public function test_auth_me_returns_company_id(): void
    {
        $this->getJson('/api/auth/me')
             ->assertOk()
             ->assertJsonPath('data.company_id', $this->companyId);
    }

    // ── Happy path ─────────────────────────────────────────────────────────────

    public function test_can_create_customer_successfully(): void
    {
        $this->postJson('/api/customers', $this->validPayload())
             ->assertCreated()
             ->assertJsonPath('data.name', 'Acme Corp')
             ->assertJsonPath('data.phone', '0501112222');
    }

    // ── Duplicate phone within same company ────────────────────────────────────

    public function test_duplicate_phone_in_same_company_is_rejected(): void
    {
        Customer::factory()->withCompany($this->companyId)->create([
            'phone' => '0501112222',
        ]);

        $response = $this->postJson('/api/customers', $this->validPayload());

        $response->assertStatus(422)
                 ->assertJsonPath('errors.phone.0', 'duplicate_customer_phone')
                 ->assertJsonStructure(['errors' => ['existing_customer' => ['id', 'name', 'code']]]);
    }

    // ── Same name, different phone — allowed ───────────────────────────────────

    public function test_same_name_with_different_phone_is_allowed(): void
    {
        Customer::factory()->withCompany($this->companyId)->create([
            'name'  => 'Acme Corp',
            'phone' => '0509998888',
            'code'  => 'CUS-FIRST', // different code
        ]);

        // validPayload uses code CUS-X001 (not taken) and phone 0501112222 (not taken)
        $this->postJson('/api/customers', $this->validPayload())
             ->assertCreated();
    }

    // ── Same phone across different companies — allowed ────────────────────────

    public function test_same_phone_in_different_company_is_allowed(): void
    {
        $otherCompany = Company::factory()->create();
        Customer::factory()->withCompany((string) $otherCompany->id)->create([
            'phone' => '0501112222',
        ]);

        $this->postJson('/api/customers', $this->validPayload())
             ->assertCreated();
    }

    // ── Null phone — no duplicate check triggered ──────────────────────────────

    public function test_customers_without_phone_can_be_created_multiple_times(): void
    {
        Customer::factory()->withCompany($this->companyId)->create(['phone' => null, 'code' => 'CUS-X001']);

        $this->postJson('/api/customers', $this->validPayload(['phone' => null, 'code' => 'CUS-X002']))
             ->assertCreated();
    }

    // ── Update: changing to a phone already used by another customer ────────────

    public function test_update_rejects_phone_already_used_by_different_customer(): void
    {
        Customer::factory()->withCompany($this->companyId)->create([
            'phone' => '0501112222',
            'code'  => 'CUS-OTHER',
        ]);

        $target = Customer::factory()->withCompany($this->companyId)->create([
            'phone' => '0509991111',
            'code'  => 'CUS-TARGET',
        ]);

        $this->putJson("/api/customers/{$target->id}", [
            'code'  => 'CUS-TARGET',
            'name'  => $target->name,
            'phone' => '0501112222', // already owned by CUS-OTHER
        ])
             ->assertStatus(422)
             ->assertJsonPath('errors.phone.0', 'duplicate_customer_phone');
    }

    // ── Update: keeping own phone — allowed ───────────────────────────────────

    public function test_update_allows_keeping_own_phone(): void
    {
        $target = Customer::factory()->withCompany($this->companyId)->create([
            'phone' => '0501112222',
            'code'  => 'CUS-SELF',
        ]);

        $this->putJson("/api/customers/{$target->id}", [
            'code'  => 'CUS-SELF',
            'name'  => 'Updated Name',
            'phone' => '0501112222', // same phone, same customer — OK
        ])
             ->assertOk();
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * @param array<string, mixed> $overrides
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'brand_id'  => $this->brandId,
            'code'      => 'CUS-X001',
            'name'      => 'Acme Corp',
            'phone'     => '0501112222',
            'is_active' => true,
        ], $overrides);
    }
}
