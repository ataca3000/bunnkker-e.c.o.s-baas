<?php

declare(strict_types=1);

namespace Tests\Feature\Crm;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Loyalty\Domain\Exceptions\LoyaltyException;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyProgram;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyReward;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyTransaction;
use Modules\Crm\Loyalty\Domain\Services\LoyaltyProgramService;
use Modules\Crm\Loyalty\Domain\Services\PointsService;
use Modules\Crm\Loyalty\Domain\Services\RewardService;
use Modules\Crm\Loyalty\Domain\Services\WalletService;
use Modules\Crm\Sales\Domain\Enums\OpportunityStatus;
use Modules\Crm\Sales\Domain\Exceptions\SalesException;
use Modules\Crm\Sales\Domain\Services\LeadService;
use Modules\Crm\Sales\Domain\Services\OpportunityService;
use Modules\Crm\Sales\Domain\Services\PipelineService;
use Modules\Crm\Sales\Domain\Services\QuoteService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * CRM & Customer Service OS — EPIC C4. Sales & Loyalty.
 *
 * Protects the sales guarantees (lead conversion bridges to C1, pipeline stages
 * drive probability, quotes derive totals) and the loyalty guarantees (append-
 * only points ledger, derived wallet balance, tier recompute, reward redemption)
 * — with Orders/Payments referenced only.
 */
class CustomerSalesLoyaltyTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Company::factory()->create()->id;
        $this->customer = app(CustomerService::class)->create($this->companyId, CustomerType::Individual, ['first_name' => 'Buyer', 'last_name' => 'One']);
    }

    private function cid(): string
    {
        return (string) $this->customer->id;
    }

    // ═══ LEADS ═════════════════════════════════════════════════════════════════

    public function test_converting_a_lead_creates_a_customer_and_opportunity(): void
    {
        $lead = app(LeadService::class)->create($this->companyId, ['name' => 'Acme Corp', 'company_name' => 'Acme Corp', 'email' => 'buy@acme.test'], 1);
        $result = app(LeadService::class)->convert($lead, ['name' => 'Acme deal', 'amount' => 5000], 1);

        $this->assertTrue($lead->fresh()->isConverted());
        $this->assertNotNull($result['customer_id']);
        $this->assertNotNull(Customer::find($result['customer_id']));   // real C1 customer created
        $this->assertSame(OpportunityStatus::Open, $result['opportunity']->status);
    }

    public function test_a_converted_lead_cannot_be_converted_again(): void
    {
        $lead = app(LeadService::class)->create($this->companyId, ['name' => 'X'], 1);
        app(LeadService::class)->convert($lead, ['name' => 'deal'], 1, $this->cid());

        $this->expectException(SalesException::class);
        app(LeadService::class)->convert($lead->fresh(), ['name' => 'again'], 1, $this->cid());
    }

    // ═══ PIPELINE & OPPORTUNITIES ══════════════════════════════════════════════

    public function test_opportunity_adopts_the_first_stage_probability(): void
    {
        app(PipelineService::class)->create($this->companyId, 'Default', [
            ['name' => 'Prospecting', 'probability' => 10],
            ['name' => 'Won', 'probability' => 100, 'is_won' => true],
        ], true);

        $opp = app(OpportunityService::class)->create($this->companyId, ['name' => 'Deal', 'customer_id' => $this->cid(), 'amount' => 1000], 1);
        $this->assertSame(10, $opp->probability);
    }

    public function test_moving_to_a_won_stage_wins_the_opportunity(): void
    {
        $pipeline = app(PipelineService::class)->create($this->companyId, 'P', [
            ['name' => 'New', 'probability' => 20],
            ['name' => 'Won', 'probability' => 100, 'is_won' => true],
        ], true);
        $wonStage = $pipeline->stages()->where('is_won', true)->firstOrFail();

        $opp = app(OpportunityService::class)->create($this->companyId, ['name' => 'D', 'customer_id' => $this->cid(), 'amount' => 500], 1);
        $won = app(OpportunityService::class)->moveToStage($opp, $wonStage);

        $this->assertSame(OpportunityStatus::Won, $won->status);
        $this->assertSame(100, $won->probability);
    }

    public function test_winning_records_the_order_by_opaque_reference(): void
    {
        $opp = app(OpportunityService::class)->create($this->companyId, ['name' => 'D', 'customer_id' => $this->cid(), 'amount' => 500], 1);
        $won = app(OpportunityService::class)->win($opp, 'order-abc-123', 1);

        $this->assertSame('order-abc-123', $won->order_reference);
        $this->assertSame(OpportunityStatus::Won, $won->status);
    }

    public function test_pipeline_forecast_is_weighted(): void
    {
        $opp = app(OpportunityService::class)->create($this->companyId, ['name' => 'D', 'customer_id' => $this->cid(), 'amount' => 1000], 1);
        $opp->update(['probability' => 40]);

        $forecast = app(OpportunityService::class)->forecast($this->companyId);
        $this->assertSame(1000.0, $forecast['total_value']);
        $this->assertSame(400.0, $forecast['weighted_value']);
    }

    // ═══ QUOTES ════════════════════════════════════════════════════════════════

    public function test_quote_totals_are_derived_from_lines(): void
    {
        $quote = app(QuoteService::class)->create($this->companyId, ['customer_id' => $this->cid(), 'discount' => 50, 'tax' => 30], [
            ['description' => 'Item A', 'quantity' => 2, 'unit_price' => 100],   // 200
            ['description' => 'Item B', 'quantity' => 1, 'unit_price' => 150, 'discount' => 20], // 130
        ], 1);

        $this->assertSame(330.0, (float) $quote->subtotal);
        $this->assertSame(310.0, (float) $quote->total); // 330 - 50 + 30
        $this->assertStringStartsWith('QT-', $quote->quote_number);
    }

    // ═══ LOYALTY ═══════════════════════════════════════════════════════════════

    private function program(array $tiers = []): LoyaltyProgram
    {
        return app(LoyaltyProgramService::class)->create($this->companyId, ['name' => 'Rewards', 'points_per_currency' => 1, 'redeem_rate' => 0.1], $tiers);
    }

    public function test_earning_and_the_wallet_balance_is_derived(): void
    {
        $account = app(LoyaltyProgramService::class)->enroll($this->companyId, $this->program(), $this->cid());
        app(PointsService::class)->earnForSpend($account, 100.0, 'order', 'ord-1');

        $wallet = app(WalletService::class)->wallet($account->refresh());
        $this->assertSame(100, $wallet['points_balance']);
        $this->assertSame(100, $wallet['lifetime_earned']);
        $this->assertSame(10.0, $wallet['redeem_value']); // 100 × 0.1
    }

    public function test_redeeming_more_than_the_balance_is_refused(): void
    {
        $account = app(LoyaltyProgramService::class)->enroll($this->companyId, $this->program(), $this->cid());
        app(PointsService::class)->earn($account, 50);

        $this->expectException(LoyaltyException::class);
        app(PointsService::class)->redeem($account, 80);
    }

    public function test_tier_is_recomputed_from_the_balance(): void
    {
        $program = $this->program([
            ['name' => 'Silver', 'min_points' => 0, 'earn_multiplier' => 1],
            ['name' => 'Gold', 'min_points' => 100, 'earn_multiplier' => 1.5],
        ]);
        $account = app(LoyaltyProgramService::class)->enroll($this->companyId, $program, $this->cid());
        $this->assertSame('Silver', $account->tier?->name);

        app(PointsService::class)->earn($account, 120);
        $this->assertSame('Gold', $account->fresh()->tier?->name);
    }

    public function test_redeeming_a_reward_spends_points_and_issues_a_voucher(): void
    {
        $program = $this->program();
        $account = app(LoyaltyProgramService::class)->enroll($this->companyId, $program, $this->cid());
        app(PointsService::class)->earn($account, 500);

        $reward = app(RewardService::class)->create($this->companyId, $program, ['name' => 'EGP 20 voucher', 'points_cost' => 200, 'reward_type' => 'voucher', 'value' => 20]);
        $redemption = app(RewardService::class)->redeem($account->refresh(), $reward, 1);

        $this->assertSame(200, $redemption->points_spent);
        $this->assertStringStartsWith('RWD-', $redemption->voucher_code);
        $this->assertSame(300, app(WalletService::class)->wallet($account->refresh())['points_balance']);
    }

    public function test_the_points_ledger_is_append_only(): void
    {
        $account = app(LoyaltyProgramService::class)->enroll($this->companyId, $this->program(), $this->cid());
        app(PointsService::class)->earn($account, 10);

        $txn = LoyaltyTransaction::query()->where('account_id', $account->id)->firstOrFail();
        $txn->points = 999;
        $this->assertFalse($txn->save());
        $this->assertFalse($txn->delete());
    }

    // ═══ SECURITY & ARCHITECTURE ═══════════════════════════════════════════════

    public function test_sales_and_loyalty_routes_require_authentication(): void
    {
        $this->getJson('/api/crm/sales/leads')->assertUnauthorized();
        $this->getJson('/api/crm/loyalty/programs')->assertUnauthorized();
    }

    public function test_modules_do_not_import_commerce_or_finance(): void
    {
        foreach (['Sales', 'Loyalty'] as $module) {
            $dir = base_path("Modules/Crm/{$module}");
            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
            foreach ($it as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }
                $source = (string) file_get_contents($file->getPathname());
                foreach (['use Modules\\Commerce', 'use Modules\\Finance', 'use Modules\\Inventory', 'use Modules\\Shipping', 'use Modules\\Logistics', 'use Modules\\POS', 'use Modules\\Marketing', 'use Modules\\Manufacturing', 'use Modules\\CustomerEngagement'] as $needle) {
                    $this->assertStringNotContainsString($needle, $source, "Crm/{$module}/".basename($file->getPathname())." must integrate by reference only ({$needle}).");
                }
            }
        }
    }
}
