<?php

declare(strict_types=1);

namespace Tests\Feature\Crm;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Executive\Domain\Services\ExecutiveDashboardService;
use Modules\Crm\Executive\Domain\Services\ExecutiveReportService;
use Modules\Crm\Executive\Domain\Services\SalesPerformanceService;
use Modules\Crm\Executive\Domain\Services\SatisfactionService;
use Modules\Crm\Executive\Domain\Services\ServicePerformanceService;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Intelligence\Domain\Services\CustomerIntelligenceService;
use Modules\Crm\Intelligence\Domain\Services\PurchaseFactService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * CRM & Customer Service OS — EPIC C6. Executive Workspace.
 *
 * Protects the guarantees an executive layer lives or dies by: the numbers are
 * derived correctly, the reporting windows are calendar-exact and reproducible,
 * the dashboard does not degrade as data grows, and — above all — the workspace
 * is READ-ONLY: no tables, no writes, no operational side effects.
 */
class ExecutiveWorkspaceTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    /** Every metric is period-scoped, so the clock is pinned for determinism. */
    private const NOW = '2026-03-15 12:00:00';

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse(self::NOW));
        $this->companyId = (string) Company::factory()->create()->id;
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function march(): ExecutivePeriod
    {
        return ExecutivePeriod::monthly(2026, 3);
    }

    private function customer(string $name, ?string $createdAt = null): Customer
    {
        $c = app(CustomerService::class)->create(
            $this->companyId, CustomerType::Individual, ['first_name' => $name, 'last_name' => 'X']
        );

        if ($createdAt !== null) {
            DB::table('customers')->where('id', $c->id)->update(['created_at' => $createdAt]);
        }

        return $c->refresh();
    }

    private function ticket(Customer $c, array $attributes = []): string
    {
        $id = (string) Str::uuid();

        DB::table('crm_service_tickets')->insert(array_merge([
            'id' => $id,
            'company_id' => $this->companyId,
            'customer_id' => $c->id,
            'ticket_number' => 'TK-'.Str::random(10),
            'subject' => 'Case',
            'status' => 'open',
            'priority' => 'normal',
            'first_response_breached' => false,
            'resolution_breached' => false,
            'reopened_count' => 0,
            'escalation_level' => 0,
            'created_at' => self::NOW,
            'updated_at' => self::NOW,
        ], $attributes));

        return $id;
    }

    private function opportunity(Customer $c, array $attributes = []): void
    {
        DB::table('crm_opportunities')->insert(array_merge([
            'id' => (string) Str::uuid(),
            'company_id' => $this->companyId,
            'customer_id' => $c->id,
            'name' => 'Deal',
            'amount' => 1000,
            'currency' => 'EGP',
            'probability' => 50,
            'status' => 'open',
            'created_at' => self::NOW,
            'updated_at' => self::NOW,
        ], $attributes));
    }

    // ═══ DASHBOARD ═══════════════════════════════════════════════════════════════

    public function test_customer_kpis_count_by_status_and_compare_periods(): void
    {
        $this->customer('MarchA', '2026-03-02 09:00:00');
        $this->customer('MarchB', '2026-03-11 09:00:00');
        $this->customer('February', '2026-02-10 09:00:00');

        $data = app(ExecutiveDashboardService::class)->overview($this->companyId, $this->march());

        $this->assertSame(3, $data['customers']['total_customers']);
        $this->assertSame(2.0, $data['customers']['new_customers']['value']);      // March only
        $this->assertSame(1.0, $data['customers']['new_customers']['previous']);   // February
        $this->assertSame('up', $data['customers']['new_customers']['trend']);
    }

    public function test_growth_series_is_bucketed_across_the_period(): void
    {
        $this->customer('W1', '2026-03-02 09:00:00');
        $this->customer('W3', '2026-03-17 09:00:00');
        $this->customer('Before', '2026-01-05 09:00:00');

        $growth = app(ExecutiveDashboardService::class)->overview($this->companyId, $this->march())['growth'];

        $this->assertSame(1, $growth['opening_customers']);   // existed before March
        $this->assertSame(3, $growth['closing_customers']);
        $this->assertSame(2.0, $growth['acquired']['value']);
        $this->assertNotEmpty($growth['series']);
        $this->assertSame(2, array_sum(array_column($growth['series'], 'customers_acquired')));
    }

    public function test_retention_and_lifetime_value_come_from_the_intelligence_profiles(): void
    {
        $repeat = $this->customer('Repeat');
        $single = $this->customer('Single');

        foreach ([[20, 100.0], [5, 150.0]] as $i => [$daysAgo, $amount]) {
            app(PurchaseFactService::class)->record($this->companyId, (string) $repeat->id, [
                'source_reference' => 'r-'.$i, 'amount' => $amount,
                'occurred_at' => Carbon::now()->subDays($daysAgo),
            ]);
        }
        app(PurchaseFactService::class)->record($this->companyId, (string) $single->id, [
            'source_reference' => 's-1', 'amount' => 50.0, 'occurred_at' => Carbon::now()->subDays(3),
        ]);

        app(CustomerIntelligenceService::class)->recomputeCompany($this->companyId);
        $data = app(ExecutiveDashboardService::class)->overview($this->companyId, $this->march());

        $this->assertSame(2, $data['retention']['customers_analysed']);
        $this->assertSame(50.0, $data['retention']['repeat_purchase_rate_percent']);
        $this->assertSame(300.0, $data['lifetime_value']['total_lifetime_value']);
        $this->assertSame(150.0, $data['lifetime_value']['average_lifetime_value']);
        // Retention + churn must account for the whole book.
        $this->assertSame(
            100.0,
            $data['retention']['retention_rate_percent'] + $data['retention']['churn_rate_percent']
        );
    }

    public function test_csat_and_nps_use_the_documented_five_point_mapping(): void
    {
        $c = $this->customer('Rater');
        // 5, 5 → promoters · 4 → passive · 1 → detractor
        foreach ([5, 5, 4, 1] as $rating) {
            $this->ticket($c, ['satisfaction_rating' => $rating]);
        }

        $satisfaction = app(SatisfactionService::class)->forPeriod($this->companyId, $this->march());

        $this->assertSame(4, $satisfaction['responses']);
        $this->assertSame(2, $satisfaction['promoters']);
        $this->assertSame(1, $satisfaction['passives']);
        $this->assertSame(1, $satisfaction['detractors']);
        $this->assertSame(75.0, $satisfaction['csat_percent']['value']);   // ratings >= 4 → 3 of 4
        $this->assertSame(25.0, $satisfaction['nps']['value']);            // 50% promoters − 25% detractors
        $this->assertSame(3.75, $satisfaction['average_rating']['value']);
    }

    public function test_open_tickets_and_sla_attainment_are_derived(): void
    {
        $c = $this->customer('Ticketed');
        $this->ticket($c, ['status' => 'open']);
        $this->ticket($c, ['status' => 'pending', 'assignee_id' => null, 'escalation_level' => 2]);
        $this->ticket($c, ['status' => 'closed', 'resolution_breached' => true, 'resolved_at' => '2026-03-10 12:00:00', 'created_at' => '2026-03-10 06:00:00']);
        $this->ticket($c, ['status' => 'cancelled']);

        $service = app(ServicePerformanceService::class)->forPeriod($this->companyId, $this->march());

        $this->assertSame(2, $service['open_tickets']);          // open + pending; closed/cancelled excluded
        $this->assertSame(1, $service['escalated_open']);
        $this->assertSame(4, $service['sla']['tickets_in_period']);
        $this->assertSame(75.0, $service['sla']['resolution_attainment_percent']);   // 1 breach of 4
        $this->assertFalse($service['sla']['meets_target']);
        $this->assertSame(6.0, $service['throughput']['average_resolution_hours']);
    }

    public function test_sales_win_rate_and_weighted_pipeline_are_derived(): void
    {
        $c = $this->customer('Buyer');
        $this->opportunity($c, ['status' => 'won', 'amount' => 5000, 'won_at' => '2026-03-05 10:00:00']);
        $this->opportunity($c, ['status' => 'lost', 'amount' => 3000, 'lost_at' => '2026-03-06 10:00:00']);
        $this->opportunity($c, ['status' => 'open', 'amount' => 2000, 'probability' => 25]);

        $sales = app(SalesPerformanceService::class)->forPeriod($this->companyId, $this->march());

        $this->assertSame(1, $sales['opportunities']['won']);
        $this->assertSame(1, $sales['opportunities']['lost']);
        $this->assertSame(50.0, $sales['opportunities']['win_rate_percent']);
        $this->assertSame(5000.0, $sales['opportunities']['won_value']);
        $this->assertSame(2000.0, $sales['opportunities']['pipeline_value']);
        $this->assertSame(500.0, $sales['opportunities']['weighted_pipeline_value']);   // 2000 × 25%
    }

    public function test_headline_summarises_the_whole_business(): void
    {
        $c = $this->customer('Head', '2026-03-02 09:00:00');
        app(PurchaseFactService::class)->record($this->companyId, (string) $c->id, [
            'source_reference' => 'h-1', 'amount' => 250.0, 'occurred_at' => '2026-03-08 10:00:00',
        ]);
        $this->ticket($c, ['satisfaction_rating' => 5]);

        $headline = app(ExecutiveDashboardService::class)->overview($this->companyId, $this->march())['headline'];

        $this->assertSame(1, $headline['total_customers']);
        $this->assertSame(250.0, $headline['revenue_in_period']);
        $this->assertSame(100.0, $headline['csat_percent']);
        $this->assertSame(100.0, $headline['nps']);
        $this->assertSame(1, $headline['open_tickets']);
        $this->assertArrayHasKey('sla_target_percent', $headline);
    }

    // ═══ REPORTING ═══════════════════════════════════════════════════════════════

    public function test_monthly_quarterly_and_annual_windows_are_calendar_exact(): void
    {
        $monthly = ExecutivePeriod::monthly(2026, 3);
        $this->assertSame('2026-03-01 00:00:00', $monthly->start->toDateTimeString());
        $this->assertSame('2026-03-31 23:59:59', $monthly->end->toDateTimeString());
        $this->assertSame('2026-02-01 00:00:00', $monthly->previous()->start->toDateTimeString());

        $quarterly = ExecutivePeriod::quarterly(2026, 1);
        $this->assertSame('2026-01-01 00:00:00', $quarterly->start->toDateTimeString());
        $this->assertSame('2026-03-31 23:59:59', $quarterly->end->toDateTimeString());
        $this->assertSame('Q1 2026', $quarterly->label);
        // The quarter before Q1 is Q4 of the preceding year.
        $this->assertSame('2025-10-01 00:00:00', $quarterly->previous()->start->toDateTimeString());

        $annual = ExecutivePeriod::annual(2026);
        $this->assertSame('2026-01-01 00:00:00', $annual->start->toDateTimeString());
        $this->assertSame('2026-12-31 23:59:59', $annual->end->toDateTimeString());
        $this->assertSame('2025-01-01 00:00:00', $annual->previous()->start->toDateTimeString());
    }

    public function test_reports_carry_every_section_and_are_reproducible(): void
    {
        $c = $this->customer('Reported', '2026-03-04 09:00:00');
        $this->ticket($c, ['satisfaction_rating' => 5]);

        $reports = app(ExecutiveReportService::class);
        $first = $reports->monthly($this->companyId, 2026, 3);
        $second = $reports->monthly($this->companyId, 2026, 3);

        $this->assertSame('Executive CRM Report — March 2026', $first['title']);

        $sections = array_column($first['sections'], 'key');
        foreach (['customers', 'growth', 'retention', 'value', 'satisfaction', 'service', 'sales', 'loyalty'] as $expected) {
            $this->assertContains($expected, $sections);
        }

        // Nothing is stored, so the same window always reproduces the same report.
        $this->assertSame($first['sections'], $second['sections']);
        $this->assertSame($first['headline'], $second['headline']);
    }

    public function test_quarterly_and_annual_reports_span_their_windows(): void
    {
        $this->customer('Jan', '2026-01-15 09:00:00');
        $this->customer('Mar', '2026-03-05 09:00:00');
        $this->customer('Jul', '2026-07-20 09:00:00');

        $reports = app(ExecutiveReportService::class);

        $q1 = $reports->quarterly($this->companyId, 2026, 1);
        $this->assertSame(2.0, $this->metric($q1, 'growth', 'Customers acquired'));

        $annual = $reports->annual($this->companyId, 2026);
        $this->assertSame(3.0, $this->metric($annual, 'growth', 'Customers acquired'));
    }

    public function test_export_is_flat_and_ready_for_a_spreadsheet(): void
    {
        $this->customer('Exported', '2026-03-04 09:00:00');

        $export = app(ExecutiveReportService::class)->export($this->companyId, $this->march());

        $this->assertSame('crm-executive-2026-03.csv', $export['filename']);
        $this->assertSame(['Section', 'Metric', 'Value', 'Previous', 'Change %', 'Trend'], $export['columns']);
        $this->assertNotEmpty($export['rows']);

        foreach ($export['rows'] as $row) {
            foreach (['section', 'metric', 'value', 'previous', 'change_percent', 'trend', 'format'] as $key) {
                $this->assertArrayHasKey($key, $row);
            }
            $this->assertIsScalar($row['section']);
            $this->assertIsScalar($row['metric']);
        }

        $this->assertSame(
            'crm-executive-2026-Q1.csv',
            app(ExecutiveReportService::class)->export($this->companyId, ExecutivePeriod::quarterly(2026, 1))['filename']
        );
    }

    // ═══ PERFORMANCE ═════════════════════════════════════════════════════════════

    public function test_dashboard_query_count_does_not_grow_with_the_data(): void
    {
        $seed = function (int $count, string $prefix): void {
            for ($i = 0; $i < $count; $i++) {
                $c = $this->customer($prefix.$i, '2026-03-0'.(($i % 9) + 1).' 09:00:00');
                $this->ticket($c, ['satisfaction_rating' => ($i % 5) + 1]);
                $this->opportunity($c, ['status' => 'won', 'won_at' => '2026-03-07 10:00:00']);
            }
        };

        $seed(2, 'small');
        $baseline = $this->countQueries(fn () => app(ExecutiveDashboardService::class)->overview($this->companyId, $this->march()));

        $seed(20, 'large');
        $scaled = $this->countQueries(fn () => app(ExecutiveDashboardService::class)->overview($this->companyId, $this->march()));

        // Aggregate queries only — ten times the data must cost the same number of
        // round trips. A per-row query would show up here immediately.
        $this->assertSame($baseline, $scaled, 'The executive dashboard must not issue per-row queries.');
    }

    public function test_dashboard_stays_within_its_query_budget(): void
    {
        $this->customer('Budget', '2026-03-04 09:00:00');

        $queries = $this->countQueries(fn () => app(ExecutiveDashboardService::class)->overview($this->companyId, $this->march()));

        $this->assertLessThan(80, $queries, "The dashboard issued {$queries} queries.");
    }

    public function test_annual_report_bucket_count_stays_bounded(): void
    {
        $annual = ExecutivePeriod::annual(2026);
        $this->assertLessThanOrEqual(12, count($annual->buckets()));

        $custom = ExecutivePeriod::custom(Carbon::parse('2020-01-01'), Carbon::parse('2026-12-31'));
        $this->assertLessThanOrEqual(12, count($custom->buckets()));
    }

    // ═══ ARCHITECTURE ════════════════════════════════════════════════════════════

    public function test_the_workspace_performs_no_writes_anywhere(): void
    {
        // `::create(` is deliberately absent from this list — Carbon::create() builds
        // a date, it does not persist anything. Eloquent writes are ruled out
        // separately by the no-models assertion below.
        $writeOperations = [
            '->insert(', '->insertGetId(', '->insertOrIgnore(', '->update(', '->updateOrInsert(',
            '->upsert(', '->delete(', '->forceDelete(', '->truncate(', '->save(',
            '->increment(', '->decrement(', '->restore(',
            'DB::statement', 'DB::unprepared', 'DB::insert', 'DB::update', 'DB::delete',
        ];

        foreach ($this->sourceFiles('Modules/Crm/Executive/Domain') as $file => $source) {
            foreach ($writeOperations as $needle) {
                $this->assertStringNotContainsString($needle, $source, "{$file} must be read-only ({$needle}).");
            }
        }

        foreach ($this->sourceFiles('Modules/Crm/Executive/Presentation') as $file => $source) {
            foreach ($writeOperations as $needle) {
                $this->assertStringNotContainsString($needle, $source, "{$file} must be read-only ({$needle}).");
            }
        }
    }

    public function test_the_workspace_defines_no_models_and_owns_no_tables(): void
    {
        foreach ($this->sourceFiles('Modules/Crm/Executive') as $file => $source) {
            $this->assertStringNotContainsString('extends Model', $source, "{$file} must not define an Eloquent model.");
            $this->assertStringNotContainsString('Eloquent\Model', $source, "{$file} must not import Eloquent's Model.");
        }

        // The only migration registers permissions; the module creates no tables.
        foreach ($this->sourceFiles('Modules/Crm/Executive/Infrastructure/Database/Migrations') as $file => $source) {
            $this->assertStringNotContainsString('Schema::create(', $source, "{$file} must not create a table.");
        }
    }

    public function test_every_executive_route_is_read_only(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with((string) $r->uri(), 'api/crm/executive'));

        $this->assertGreaterThan(0, $routes->count());

        foreach ($routes as $route) {
            $verbs = array_diff($route->methods(), ['GET', 'HEAD']);
            $this->assertEmpty($verbs, "Route {$route->uri()} exposes a write verb: ".implode(',', $verbs));
        }
    }

    public function test_the_workspace_does_not_import_finance_commerce_or_operations(): void
    {
        $forbidden = [
            'use Modules\\Commerce', 'use Modules\\Finance', 'use Modules\\Inventory',
            'use Modules\\Shipping', 'use Modules\\Logistics', 'use Modules\\POS',
            'use Modules\\Marketing', 'use Modules\\Manufacturing', 'use Modules\\Operations',
        ];

        foreach ($this->sourceFiles('Modules/Crm/Executive') as $file => $source) {
            foreach ($forbidden as $needle) {
                $this->assertStringNotContainsString($needle, $source, "{$file} must not reach into operational modules ({$needle}).");
            }
        }
    }

    public function test_executive_routes_require_authentication(): void
    {
        $this->getJson('/api/crm/executive/dashboard')->assertUnauthorized();
        $this->getJson('/api/crm/executive/reports/monthly')->assertUnauthorized();
        $this->getJson('/api/crm/executive/reports/export')->assertUnauthorized();
    }

    // ═══ Helpers ═════════════════════════════════════════════════════════════════

    /** @return array<string, string> basename => source */
    private function sourceFiles(string $relativeDir): array
    {
        $dir = base_path($relativeDir);
        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        foreach ($it as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $out[basename($file->getPathname())] = (string) file_get_contents($file->getPathname());
            }
        }

        return $out;
    }

    private function countQueries(callable $work): int
    {
        $count = 0;
        DB::listen(function () use (&$count): void {
            $count++;
        });

        $work();

        return $count;
    }

    /** Pull one metric value out of a generated report. */
    private function metric(array $report, string $sectionKey, string $label): mixed
    {
        foreach ($report['sections'] as $section) {
            if ($section['key'] !== $sectionKey) {
                continue;
            }
            foreach ($section['metrics'] as $metric) {
                if ($metric['label'] === $label) {
                    return $metric['value'];
                }
            }
        }

        $this->fail("Metric {$sectionKey}/{$label} not found in the report.");
    }
}
