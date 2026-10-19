<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Finance OS — EPIC F1. API surface and the security model.
 *
 * The manual-journal lifecycle is under segregation of duties: create (maker),
 * post (checker) and reverse are distinct permissions, and the checker can never
 * be the maker.
 */
class FinanceApiTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();
        $this->company = Company::factory()->create();
    }

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    /** A user holding exactly the given finance permissions. */
    private function userWith(array $permissions): User
    {
        $user = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Fin '.$this->suffix(),
            'slug' => 'fin-'.$this->suffix(),
            'is_system' => false,
        ]);
        $ids = Permission::whereIn('name', $permissions)->pluck('id');
        $role->permissions()->attach($ids);
        $user->roles()->attach($role->id);

        return $user;
    }

    private function admin(): User
    {
        $user = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create(['name' => 'Fin Admin '.$this->suffix(), 'slug' => 'fin-admin-'.$this->suffix(), 'is_system' => true]);
        $user->roles()->attach($role->id);

        return $user;
    }

    private function openPeriod(): FiscalPeriod
    {
        $start = Carbon::today()->startOfMonth();
        $year = app(FiscalCalendarService::class)->createYear(
            (string) $this->company->id, 'FY-'.$this->suffix(), $start, $start->copy()->addMonths(11)->endOfMonth(),
        );

        return $year->periods()->where('period_number', 1)->firstOrFail();
    }

    private function account(AccountType $type): Account
    {
        return app(ChartOfAccountsService::class)->create([
            'company_id' => (string) $this->company->id,
            'code' => strtoupper($type->value[0]).'-'.$this->suffix(),
            'name' => ucfirst($type->value),
            'account_type' => $type,
        ]);
    }

    // ═══ CHART OF ACCOUNTS ═══════════════════════════════════════════════════

    public function test_an_account_can_be_created_and_listed(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->postJson('/api/finance/accounts', [
            'code' => 'CASH-'.$this->suffix(),
            'name' => 'Cash',
            'account_type' => 'asset',
        ])->assertCreated()
            ->assertJsonPath('data.normal_balance', 'debit')
            ->assertJsonPath('data.statement', 'balance_sheet');

        $this->actingAs($admin)->getJson('/api/finance/accounts')->assertOk();
    }

    // ═══ MANUAL JOURNAL — SEGREGATION OF DUTIES ══════════════════════════════

    public function test_maker_and_checker_post_a_journal_but_not_the_same_person(): void
    {
        $this->openPeriod();
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);

        $maker = $this->userWith(['finance.gl.view', 'finance.journal.create']);
        $checker = $this->userWith(['finance.gl.view', 'finance.journal.post']);

        // Maker submits a balanced draft.
        $draft = $this->actingAs($maker)->postJson('/api/finance/journals', [
            'entry_date' => Carbon::today()->toDateString(),
            'reference' => 'JV-1',
            'lines' => [
                ['account_id' => $cash->uuid, 'side' => 'debit', 'amount' => 500],
                ['account_id' => $revenue->uuid, 'side' => 'credit', 'amount' => 500],
            ],
        ])->assertCreated()->assertJsonPath('data.status', 'draft');

        $uuid = $draft->json('data.id');

        // A DIFFERENT person approves and posts.
        $this->actingAs($checker)->patchJson("/api/finance/journals/{$uuid}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'posted');
    }

    public function test_the_maker_cannot_approve_their_own_journal_via_api(): void
    {
        $this->openPeriod();
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);

        // One user who holds BOTH create and post still cannot self-approve.
        $both = $this->userWith(['finance.gl.view', 'finance.journal.create', 'finance.journal.post']);

        $draft = $this->actingAs($both)->postJson('/api/finance/journals', [
            'entry_date' => Carbon::today()->toDateString(),
            'lines' => [
                ['account_id' => $cash->uuid, 'side' => 'debit', 'amount' => 100],
                ['account_id' => $revenue->uuid, 'side' => 'credit', 'amount' => 100],
            ],
        ])->assertCreated();

        $this->actingAs($both)->patchJson("/api/finance/journals/{$draft->json('data.id')}/approve")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'may not approve it'));
    }

    public function test_an_unbalanced_journal_is_refused_by_the_api(): void
    {
        $this->openPeriod();
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $maker = $this->userWith(['finance.gl.view', 'finance.journal.create']);

        $this->actingAs($maker)->postJson('/api/finance/journals', [
            'entry_date' => Carbon::today()->toDateString(),
            'lines' => [
                ['account_id' => $cash->uuid, 'side' => 'debit', 'amount' => 100],
                ['account_id' => $revenue->uuid, 'side' => 'credit', 'amount' => 80],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'does not balance'));
    }

    // ═══ TRIAL BALANCE ═══════════════════════════════════════════════════════

    public function test_the_trial_balance_endpoint_answers(): void
    {
        $viewer = $this->userWith(['finance.trialbalance.view']);

        $this->actingAs($viewer)->getJson('/api/finance/trial-balance')
            ->assertOk()
            ->assertJsonStructure(['data' => ['lines', 'total_debit', 'total_credit', 'is_balanced']]);
    }

    // ═══ ACCESS CONTROL ══════════════════════════════════════════════════════

    public function test_endpoints_require_authentication(): void
    {
        $this->getJson('/api/finance/accounts')->assertUnauthorized();
        $this->getJson('/api/finance/trial-balance')->assertUnauthorized();
        $this->postJson('/api/finance/journals', [])->assertUnauthorized();
    }

    public function test_creating_an_account_requires_the_manage_permission(): void
    {
        // A view-only user cannot create.
        $viewer = $this->userWith(['finance.gl.view']);

        $this->actingAs($viewer)->postJson('/api/finance/accounts', [
            'code' => 'X', 'name' => 'X', 'account_type' => 'asset',
        ])->assertForbidden();
    }

    public function test_posting_a_journal_requires_the_post_permission(): void
    {
        $this->openPeriod();
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);

        $maker = $this->userWith(['finance.gl.view', 'finance.journal.create']);
        $draft = $this->actingAs($maker)->postJson('/api/finance/journals', [
            'entry_date' => Carbon::today()->toDateString(),
            'lines' => [
                ['account_id' => $cash->uuid, 'side' => 'debit', 'amount' => 100],
                ['account_id' => $revenue->uuid, 'side' => 'credit', 'amount' => 100],
            ],
        ])->assertCreated();

        // The maker holds create but NOT post — approval is forbidden.
        $this->actingAs($maker)->patchJson("/api/finance/journals/{$draft->json('data.id')}/approve")
            ->assertForbidden();
    }

    public function test_the_twelve_finance_permissions_are_seeded(): void
    {
        foreach ([
            'finance.gl.view', 'finance.trialbalance.view', 'finance.coa.manage',
            'finance.dimension.manage', 'finance.tax.manage', 'finance.posting.manage',
            'finance.period.manage', 'finance.journal.create', 'finance.journal.approve',
            'finance.journal.post', 'finance.journal.reverse', 'finance.admin',
        ] as $name) {
            $this->assertTrue(Permission::where('name', $name)->exists(), "{$name} must be seeded.");
        }
    }
}
