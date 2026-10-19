<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Infrastructure\Database\Seeders\AccountRoleSeeder;
use Modules\Finance\Infrastructure\Database\Seeders\ChartOfAccountsSeeder;
use Modules\Finance\Integration\Domain\Services\AccountRoleResolver;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;
use Throwable;

/**
 * Finance OS — TASK-FIN-003. Account role → GL account mapping.
 *
 * Posting rules name accounts by role. A role that resolves to the wrong account
 * posts real money to the wrong place and nothing errors, so these tests assert
 * the properties that keep that from happening: one account per role, always
 * postable, always the caller's own company, and a loud failure when a role is
 * not mapped at all.
 */
class AccountRoleMappingTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();

        (new ChartOfAccountsSeeder)->seedCompany((string) $this->company->id);
        (new AccountRoleSeeder)->seedCompany((string) $this->company->id);
    }

    public function test_every_defined_role_maps_to_a_postable_active_account_of_the_same_company(): void
    {
        $rows = DB::table('finance_account_roles as r')
            ->join('finance_accounts as a', 'a.id', '=', 'r.account_id')
            ->where('r.company_id', $this->company->id)
            ->select('r.role', 'a.code', 'a.is_postable', 'a.is_active', 'a.company_id')
            ->get();

        $this->assertCount(
            count((new AccountRoleSeeder)->definitions()),
            $rows,
            'Every definition must produce exactly one joinable mapping row.',
        );

        foreach ($rows as $row) {
            $this->assertTrue((bool) $row->is_postable, "Role '{$row->role}' maps to non-postable account {$row->code}.");
            $this->assertTrue((bool) $row->is_active, "Role '{$row->role}' maps to inactive account {$row->code}.");
            $this->assertSame((string) $this->company->id, (string) $row->company_id, "Role '{$row->role}' maps across companies.");
        }
    }

    public function test_no_role_is_mapped_twice(): void
    {
        $duplicated = DB::table('finance_account_roles')
            ->where('company_id', $this->company->id)
            ->select('role', DB::raw('COUNT(*) as n'))
            ->groupBy('role')
            ->having('n', '>', 1)
            ->pluck('role');

        $this->assertEmpty($duplicated, 'Ambiguous mapping — a role resolved to more than one account: '.$duplicated->implode(', '));
    }

    public function test_seeding_twice_creates_nothing_and_changes_nothing(): void
    {
        $before = DB::table('finance_account_roles')->where('company_id', $this->company->id)
            ->orderBy('role')->pluck('account_id', 'role');

        $this->assertSame(0, (new AccountRoleSeeder)->seedCompany((string) $this->company->id));

        $after = DB::table('finance_account_roles')->where('company_id', $this->company->id)
            ->orderBy('role')->pluck('account_id', 'role');

        $this->assertEquals($before, $after, 'Re-seeding must never re-point an existing mapping.');
    }

    public function test_resolver_returns_the_mapped_account_for_every_defined_role(): void
    {
        $resolver = app(AccountRoleResolver::class);

        foreach ((new AccountRoleSeeder)->definitions() as $role => [$code, $_]) {
            $accountId = $resolver->resolve((string) $this->company->id, $role);

            $this->assertSame(
                $code,
                DB::table('finance_accounts')->where('id', $accountId)->value('code'),
                "Role '{$role}' did not resolve to account {$code}.",
            );
        }
    }

    public function test_an_unmapped_role_throws_rather_than_resolving_to_nothing(): void
    {
        // 'inventory' is unmapped by policy: stock stays separated by class, so
        // there is no single postable Inventory account to resolve to. The
        // contract that matters is that this fails loudly instead of posting.
        $this->expectException(FinanceException::class);

        app(AccountRoleResolver::class)->resolve((string) $this->company->id, 'inventory');
    }

    /** Requirement 2 — inventory stays separated by class, never collapsed. */
    public function test_inventory_classes_are_four_distinct_postable_control_accounts(): void
    {
        $classes = ['1420' => 'raw_materials', '1440' => 'packaging_materials', '1430' => 'wip', '1410' => 'finished_goods'];

        $accountIds = [];

        foreach ($classes as $code => $role) {
            $account = DB::table('finance_accounts')
                ->where('company_id', $this->company->id)->where('code', $code)->first();

            $this->assertNotNull($account, "Inventory class account {$code} is missing.");
            $this->assertTrue((bool) $account->is_postable, "Inventory class {$code} must be postable.");
            $this->assertTrue((bool) $account->is_control, "Inventory class {$code} must be a control account.");
            $this->assertSame('inventory', $account->control_subledger, "Inventory class {$code} must carry the inventory subledger.");

            $accountIds[] = app(AccountRoleResolver::class)->resolve((string) $this->company->id, $role);
        }

        $this->assertCount(4, array_unique($accountIds), 'The four inventory classes must never collapse onto one account.');

        // 1400 is the header. If it ever became postable, a generic inventory leg
        // could silently start resolving and defeat the whole policy.
        $this->assertFalse(
            (bool) DB::table('finance_accounts')
                ->where('company_id', $this->company->id)->where('code', '1400')->value('is_postable'),
            '1400 Inventory must remain a non-postable header.',
        );
    }

    /** Requirement 3 — one operational revenue account, not one per channel. */
    public function test_sales_revenue_resolves_to_product_sales_for_every_channel(): void
    {
        $accountId = app(AccountRoleResolver::class)->resolve((string) $this->company->id, 'sales_revenue');

        $this->assertSame('4110', DB::table('finance_accounts')->where('id', $accountId)->value('code'));
    }

    /** Requirement 5 — earning and redeeming are different accounting events. */
    public function test_loyalty_expense_is_a_different_account_from_loyalty_redemptions(): void
    {
        $expense = app(AccountRoleResolver::class)->resolve((string) $this->company->id, 'loyalty_expense');

        $this->assertSame('5940', DB::table('finance_accounts')->where('id', $expense)->value('code'));

        $redemptions = DB::table('finance_accounts')
            ->where('company_id', $this->company->id)->where('code', '4240')->value('id');

        $this->assertNotSame((int) $redemptions, (int) $expense, 'Loyalty expense must not reuse Loyalty Redemptions.');
    }

    public function test_a_role_mapped_for_another_company_does_not_leak(): void
    {
        $other = Company::factory()->create();

        try {
            app(AccountRoleResolver::class)->resolve((string) $other->id, 'ar_control');
            $this->fail('A role mapped only for another company must not resolve.');
        } catch (Throwable $e) {
            $this->assertInstanceOf(FinanceException::class, $e);
        }
    }
}
