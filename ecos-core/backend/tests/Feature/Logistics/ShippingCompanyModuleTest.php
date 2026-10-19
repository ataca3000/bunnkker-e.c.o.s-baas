<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingContract;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * TASK-LOG-001 — Shipping Companies Module
 *
 * Verifies:
 *   Dashboard
 *    1. GET  /stats                        returns the four dashboard counters
 *    2. GET  /next-code                    suggests the next sequential SHC code
 *
 *   Shipping Companies
 *    3. GET  /                             returns paginated list
 *    4. GET  /                             default view hides archived carriers
 *    5. GET  /?status=archived             surfaces archived carriers
 *    6. GET  /?type=internal               filters by type
 *    7. GET  /?search=                     searches name / code / contact / phone
 *    8. POST /                             creates an external carrier
 *    9. POST /                             creates an internal fleet carrier
 *   10. POST /                             rejects a duplicate code            (BR-1)
 *   11. POST /                             requires name, code and type
 *   12. GET  /{id}                         returns contracts + mappings
 *   13. PUT  /{id}                         updates editable fields
 *   14. PUT  /{id}                         rejects a type change               (BR-2)
 *   15. PATCH /{id}/status                 deactivates, activates and archives
 *   16. PATCH /{id}/status                 restores an archived carrier
 *
 *   Contracts
 *   17. POST /{id}/contracts               creates a contract
 *   18. POST /{id}/contracts               supports multiple contracts         (BR-4)
 *   19. POST /{id}/contracts               rejects end_date before start_date
 *   20. POST /{id}/contracts               creating an active contract demotes siblings (BR-5)
 *   21. PATCH /{id}/contracts/{c}/activate promotes one and demotes the rest   (BR-5)
 *   22. PUT  /{id}/contracts/{c}           edits a contract
 *   23. PUT  /{id}/contracts/{c}           archives (deactivates) a contract
 *   24. DELETE /{id}/contracts/{c}         deletes a contract
 *   25. POST /{id}/contracts               blocked while archived              (BR-3)
 *
 *   Company Mapping
 *   26. POST /{id}/companies               links an ECOS company
 *   27. POST /{id}/companies               links MANY ECOS companies (multi-company)
 *   28. POST /{id}/companies               rejects a duplicate link
 *   29. GET  /{id}/companies               resolves company name + code
 *   30. DELETE /{id}/companies/{m}         unlinks a company
 *   31. POST /{id}/companies               blocked while archived              (BR-3)
 *
 *   Security
 *   32. All routes require authentication
 */
class ShippingCompanyModuleTest extends TestCase
{
    // The suite runs against the already-migrated test schema and rolls back after
    // each case. RefreshDatabase is deliberately avoided: a global migrate:fresh
    // currently fails on an unrelated module's migration, which would mask results.
    use DatabaseTransactions;

    private const BASE = '/api/logistics/shipping-companies';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Bosta',
            'code' => 'SHC-001',
            'type' => 'external',
            'contact_person' => 'Ahmed Salem',
            'phone' => '01000000001',
            'email' => 'ops@bosta.co',
            'status' => 'active',
        ], $overrides);
    }

    private function makeCompany(array $overrides = []): ShippingCompany
    {
        return ShippingCompany::create($this->payload($overrides));
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    public function test_stats_returns_dashboard_counters(): void
    {
        $this->makeCompany(['code' => 'SHC-001', 'type' => 'external', 'status' => 'active']);
        $this->makeCompany(['code' => 'SHC-002', 'type' => 'internal', 'status' => 'inactive']);
        $this->makeCompany(['code' => 'SHC-003', 'type' => 'internal', 'status' => 'archived']);

        $this->auth()->getJson(self::BASE.'/stats')
            ->assertOk()
            ->assertJson([
                'total_companies' => 3,
                'active_companies' => 1,
                'internal_companies' => 2,
                'external_companies' => 1,
                'archived_companies' => 1,
            ]);
    }

    public function test_next_code_suggests_sequential_code(): void
    {
        $this->auth()->getJson(self::BASE.'/next-code')
            ->assertOk()
            ->assertJson(['code' => 'SHC-001']);

        $this->makeCompany(['code' => 'SHC-001']);
        $this->makeCompany(['code' => 'SHC-002']);

        $this->auth()->getJson(self::BASE.'/next-code')
            ->assertOk()
            ->assertJson(['code' => 'SHC-003']);
    }

    // ── List ──────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_list(): void
    {
        $this->makeCompany(['code' => 'SHC-001']);
        $this->makeCompany(['code' => 'SHC-002']);

        $this->auth()->getJson(self::BASE)
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
    }

    public function test_index_hides_archived_by_default(): void
    {
        $this->makeCompany(['code' => 'SHC-001', 'status' => 'active']);
        $this->makeCompany(['code' => 'SHC-002', 'status' => 'archived']);

        $this->auth()->getJson(self::BASE)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.code', 'SHC-001');
    }

    public function test_index_can_surface_archived(): void
    {
        $this->makeCompany(['code' => 'SHC-001', 'status' => 'active']);
        $this->makeCompany(['code' => 'SHC-002', 'status' => 'archived']);

        $this->auth()->getJson(self::BASE.'?status=archived')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.code', 'SHC-002');
    }

    public function test_index_filters_by_type(): void
    {
        $this->makeCompany(['code' => 'SHC-001', 'type' => 'external']);
        $this->makeCompany(['code' => 'SHC-002', 'type' => 'internal']);

        $this->auth()->getJson(self::BASE.'?type=internal')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.type', 'internal');
    }

    public function test_index_searches_name_code_and_contact(): void
    {
        $this->makeCompany(['code' => 'SHC-001', 'name' => 'Bosta', 'contact_person' => 'Ahmed']);
        $this->makeCompany(['code' => 'SHC-002', 'name' => 'Aramex', 'contact_person' => 'Mona']);

        $this->auth()->getJson(self::BASE.'?search=Aramex')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.name', 'Aramex');

        $this->auth()->getJson(self::BASE.'?search=Mona')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $this->auth()->getJson(self::BASE.'?search=SHC-001')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.code', 'SHC-001');
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_store_creates_external_carrier(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.code', 'SHC-001')
            ->assertJsonPath('data.type', 'external')
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('logistics_shipping_companies', [
            'code' => 'SHC-001',
            'type' => 'external',
        ]);
    }

    public function test_store_creates_internal_fleet(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload([
            'name' => 'ECOS Internal Fleet',
            'code' => 'SHC-010',
            'type' => 'internal',
        ]))
            ->assertCreated()
            ->assertJsonPath('data.type', 'internal');
    }

    /** BR-1: company code must be unique. */
    public function test_store_rejects_duplicate_code(): void
    {
        $this->makeCompany(['code' => 'SHC-001']);

        $this->auth()->postJson(self::BASE, $this->payload(['code' => 'SHC-001']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    public function test_store_requires_mandatory_fields(): void
    {
        $this->auth()->postJson(self::BASE, [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'code', 'type']);
    }

    public function test_store_rejects_invalid_type(): void
    {
        $this->auth()->postJson(self::BASE, $this->payload(['type' => 'hybrid']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('type');
    }

    // ── Show / Update ─────────────────────────────────────────────────────────

    public function test_show_returns_contracts_and_mappings(): void
    {
        $company = $this->makeCompany();
        $company->contracts()->create(['name' => 'C1', 'status' => 'active']);
        $ecos = Company::factory()->create();
        $company->mappings()->create(['company_id' => $ecos->id]);

        $this->auth()->getJson(self::BASE.'/'.$company->id)
            ->assertOk()
            ->assertJsonPath('data.code', 'SHC-001')
            ->assertJsonCount(1, 'data.contracts')
            ->assertJsonCount(1, 'data.mappings')
            ->assertJsonPath('data.active_contract.name', 'C1');
    }

    public function test_update_edits_fields(): void
    {
        $company = $this->makeCompany();

        $this->auth()->putJson(self::BASE.'/'.$company->id, [
            'name' => 'Bosta Egypt',
            'phone' => '01099999999',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Bosta Egypt')
            ->assertJsonPath('data.phone', '01099999999');
    }

    /** BR-2: type is immutable after creation. */
    public function test_update_rejects_type_change(): void
    {
        $company = $this->makeCompany(['type' => 'external']);

        $this->auth()->putJson(self::BASE.'/'.$company->id, ['type' => 'internal'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Shipping company type cannot be changed after creation.');

        $this->assertSame('external', $company->fresh()->type);
    }

    public function test_update_rejects_duplicate_code(): void
    {
        $this->makeCompany(['code' => 'SHC-001']);
        $second = $this->makeCompany(['code' => 'SHC-002']);

        $this->auth()->putJson(self::BASE.'/'.$second->id, ['code' => 'SHC-001'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');
    }

    // ── Status lifecycle ──────────────────────────────────────────────────────

    public function test_status_transitions(): void
    {
        $company = $this->makeCompany(['status' => 'active']);

        $this->auth()->patchJson(self::BASE.'/'.$company->id.'/status', ['status' => 'inactive'])
            ->assertOk()->assertJsonPath('data.status', 'inactive');

        $this->auth()->patchJson(self::BASE.'/'.$company->id.'/status', ['status' => 'active'])
            ->assertOk()->assertJsonPath('data.status', 'active');

        $this->auth()->patchJson(self::BASE.'/'.$company->id.'/status', ['status' => 'archived'])
            ->assertOk()->assertJsonPath('data.status', 'archived');
    }

    public function test_archived_company_can_be_restored(): void
    {
        $company = $this->makeCompany(['status' => 'archived']);

        $this->auth()->patchJson(self::BASE.'/'.$company->id.'/status', ['status' => 'inactive'])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');
    }

    public function test_status_rejects_unknown_value(): void
    {
        $company = $this->makeCompany();

        $this->auth()->patchJson(self::BASE.'/'.$company->id.'/status', ['status' => 'deleted'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    // ── Contracts ─────────────────────────────────────────────────────────────

    public function test_store_contract(): void
    {
        $company = $this->makeCompany();

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', [
            'name' => '2026 Master Agreement',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'payment_terms' => 'Net 30',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', '2026 Master Agreement')
            ->assertJsonPath('data.payment_terms', 'Net 30')
            ->assertJsonPath('data.status', 'inactive');
    }

    /** BR-4: multiple contracts are supported. */
    public function test_company_supports_multiple_contracts(): void
    {
        $company = $this->makeCompany();

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', ['name' => 'C1'])->assertCreated();
        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', ['name' => 'C2'])->assertCreated();
        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', ['name' => 'C3'])->assertCreated();

        $this->auth()->getJson(self::BASE.'/'.$company->id.'/contracts')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_store_contract_rejects_end_before_start(): void
    {
        $company = $this->makeCompany();

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', [
            'name' => 'Bad Range',
            'start_date' => '2026-05-01',
            'end_date' => '2026-01-01',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('end_date');
    }

    public function test_store_contract_requires_name(): void
    {
        $company = $this->makeCompany();

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    /** BR-5: creating an active contract demotes every sibling. */
    public function test_creating_active_contract_demotes_siblings(): void
    {
        $company = $this->makeCompany();
        $first = $company->contracts()->create(['name' => 'C1', 'status' => 'active']);

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', [
            'name' => 'C2',
            'status' => 'active',
        ])->assertCreated();

        $this->assertSame('inactive', $first->fresh()->status);
        $this->assertSame(1, $company->contracts()->where('status', 'active')->count());
    }

    /** BR-5: only one active contract may exist per company. */
    public function test_activate_contract_demotes_all_others(): void
    {
        $company = $this->makeCompany();
        $c1 = $company->contracts()->create(['name' => 'C1', 'status' => 'active']);
        $c2 = $company->contracts()->create(['name' => 'C2', 'status' => 'inactive']);
        $c3 = $company->contracts()->create(['name' => 'C3', 'status' => 'inactive']);

        $this->auth()->patchJson(self::BASE.'/'.$company->id.'/contracts/'.$c2->id.'/activate')
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertSame('inactive', $c1->fresh()->status);
        $this->assertSame('active', $c2->fresh()->status);
        $this->assertSame('inactive', $c3->fresh()->status);
        $this->assertSame(1, $company->contracts()->where('status', 'active')->count());
    }

    /** BR-5 held on update as well as on activate. */
    public function test_updating_contract_to_active_demotes_siblings(): void
    {
        $company = $this->makeCompany();
        $c1 = $company->contracts()->create(['name' => 'C1', 'status' => 'active']);
        $c2 = $company->contracts()->create(['name' => 'C2', 'status' => 'inactive']);

        $this->auth()->putJson(self::BASE.'/'.$company->id.'/contracts/'.$c2->id, ['status' => 'active'])
            ->assertOk();

        $this->assertSame('inactive', $c1->fresh()->status);
        $this->assertSame(1, $company->contracts()->where('status', 'active')->count());
    }

    public function test_update_contract_edits_fields(): void
    {
        $company = $this->makeCompany();
        $contract = $company->contracts()->create(['name' => 'C1']);

        $this->auth()->putJson(self::BASE.'/'.$company->id.'/contracts/'.$contract->id, [
            'name' => 'C1 Revised',
            'payment_terms' => 'Net 45',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'C1 Revised')
            ->assertJsonPath('data.payment_terms', 'Net 45');
    }

    /** Archiving a contract = deactivating it; the record is preserved. */
    public function test_contract_can_be_archived(): void
    {
        $company = $this->makeCompany();
        $contract = $company->contracts()->create(['name' => 'C1', 'status' => 'active']);

        $this->auth()->putJson(self::BASE.'/'.$company->id.'/contracts/'.$contract->id, ['status' => 'inactive'])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        $this->assertDatabaseHas('logistics_shipping_contracts', [
            'id' => $contract->id,
            'status' => 'inactive',
        ]);
    }

    public function test_delete_contract(): void
    {
        $company = $this->makeCompany();
        $contract = $company->contracts()->create(['name' => 'C1']);

        $this->auth()->deleteJson(self::BASE.'/'.$company->id.'/contracts/'.$contract->id)
            ->assertNoContent();

        $this->assertDatabaseMissing('logistics_shipping_contracts', ['id' => $contract->id]);
    }

    public function test_contract_of_another_company_is_not_reachable(): void
    {
        $a = $this->makeCompany(['code' => 'SHC-001']);
        $b = $this->makeCompany(['code' => 'SHC-002']);
        $contract = $b->contracts()->create(['name' => 'B-C1']);

        $this->auth()->putJson(self::BASE.'/'.$a->id.'/contracts/'.$contract->id, ['name' => 'hijack'])
            ->assertNotFound();
    }

    /** BR-3: archived companies cannot receive new assignments. */
    public function test_archived_company_cannot_receive_contracts(): void
    {
        $company = $this->makeCompany(['status' => 'archived']);

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/contracts', ['name' => 'Blocked'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Archived shipping companies cannot receive new contracts.');

        $this->assertSame(0, $company->contracts()->count());
    }

    // ── Company Mapping ───────────────────────────────────────────────────────

    public function test_maps_shipping_company_to_ecos_company(): void
    {
        $company = $this->makeCompany();
        $ecos = Company::factory()->create();

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/companies', ['company_id' => $ecos->id])
            ->assertCreated()
            ->assertJsonPath('data.company_id', $ecos->id)
            ->assertJsonPath('data.company_name', $ecos->name);
    }

    /** Multi-company: one carrier serves many ECOS companies. */
    public function test_one_carrier_maps_to_many_ecos_companies(): void
    {
        $company = $this->makeCompany();
        $honey = Company::factory()->create(['name' => 'ECOS Honey']);
        $nuts = Company::factory()->create(['name' => 'ECOS Nuts']);
        $fruits = Company::factory()->create(['name' => 'ECOS Fruits']);

        foreach ([$honey, $nuts, $fruits] as $ecos) {
            $this->auth()->postJson(self::BASE.'/'.$company->id.'/companies', ['company_id' => $ecos->id])
                ->assertCreated();
        }

        $this->auth()->getJson(self::BASE.'/'.$company->id.'/companies')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->assertSame(3, $company->mappings()->count());
    }

    public function test_mapping_rejects_duplicate_link(): void
    {
        $company = $this->makeCompany();
        $ecos = Company::factory()->create();
        $company->mappings()->create(['company_id' => $ecos->id]);

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/companies', ['company_id' => $ecos->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('company_id');
    }

    public function test_mapping_rejects_unknown_company(): void
    {
        $company = $this->makeCompany();

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/companies', [
            'company_id' => '00000000-0000-0000-0000-000000000000',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('company_id');
    }

    /** The same ECOS company may be served by several carriers. */
    public function test_same_ecos_company_may_be_linked_to_multiple_carriers(): void
    {
        $bosta = $this->makeCompany(['code' => 'SHC-001']);
        $fleet = $this->makeCompany(['code' => 'SHC-002', 'type' => 'internal']);
        $ecos = Company::factory()->create();

        $this->auth()->postJson(self::BASE.'/'.$bosta->id.'/companies', ['company_id' => $ecos->id])
            ->assertCreated();
        $this->auth()->postJson(self::BASE.'/'.$fleet->id.'/companies', ['company_id' => $ecos->id])
            ->assertCreated();
    }

    public function test_unlink_mapping(): void
    {
        $company = $this->makeCompany();
        $ecos = Company::factory()->create();
        $mapping = $company->mappings()->create(['company_id' => $ecos->id]);

        $this->auth()->deleteJson(self::BASE.'/'.$company->id.'/companies/'.$mapping->id)
            ->assertNoContent();

        $this->assertSame(0, $company->mappings()->count());
    }

    /** BR-3: archived companies cannot receive new assignments. */
    public function test_archived_company_cannot_receive_mappings(): void
    {
        $company = $this->makeCompany(['status' => 'archived']);
        $ecos = Company::factory()->create();

        $this->auth()->postJson(self::BASE.'/'.$company->id.'/companies', ['company_id' => $ecos->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Archived shipping companies cannot be linked to ECOS companies.');

        $this->assertSame(0, $company->mappings()->count());
    }

    // ── Cascade & integrity ───────────────────────────────────────────────────

    public function test_deleting_company_cascades_to_contracts_and_mappings(): void
    {
        $company = $this->makeCompany();
        $contract = $company->contracts()->create(['name' => 'C1']);
        $ecos = Company::factory()->create();
        $mapping = $company->mappings()->create(['company_id' => $ecos->id]);

        $company->delete();

        $this->assertDatabaseMissing('logistics_shipping_contracts', ['id' => $contract->id]);
        $this->assertDatabaseMissing('logistics_shipping_company_mappings', ['id' => $mapping->id]);
    }

    public function test_contract_expiry_is_derived_from_end_date(): void
    {
        $company = $this->makeCompany();
        $expired = $company->contracts()->create(['name' => 'Old', 'end_date' => '2020-01-01']);
        $current = $company->contracts()->create(['name' => 'New', 'end_date' => '2999-01-01']);

        $this->assertTrue($expired->fresh()->isExpired());
        $this->assertFalse($current->fresh()->isExpired());
    }

    public function test_model_constants_match_schema(): void
    {
        $this->assertSame(['internal', 'external'], ShippingCompany::TYPES);
        $this->assertSame(['active', 'inactive', 'archived'], ShippingCompany::STATUSES);
        $this->assertSame(['active', 'inactive'], ShippingContract::STATUSES);
    }

    // ── Security ──────────────────────────────────────────────────────────────

    public function test_routes_require_authentication(): void
    {
        $company = $this->makeCompany();

        $this->getJson(self::BASE)->assertUnauthorized();
        $this->getJson(self::BASE.'/stats')->assertUnauthorized();
        $this->getJson(self::BASE.'/'.$company->id)->assertUnauthorized();
        $this->postJson(self::BASE, $this->payload(['code' => 'SHC-999']))->assertUnauthorized();
        $this->patchJson(self::BASE.'/'.$company->id.'/status', ['status' => 'archived'])->assertUnauthorized();
        $this->postJson(self::BASE.'/'.$company->id.'/contracts', ['name' => 'X'])->assertUnauthorized();
        $this->postJson(self::BASE.'/'.$company->id.'/companies', ['company_id' => 'x'])->assertUnauthorized();
    }
}
