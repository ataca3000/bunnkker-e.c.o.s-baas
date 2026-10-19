<?php

declare(strict_types=1);

namespace Tests\Feature\Core;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * TASK-GL-HOTFIX-001 — the executive dashboard aggregator must run on the
 * database this platform actually deploys.
 *
 * `GET /api/admin/executive-dashboard` returned 500 on every request for the
 * life of the endpoint: it was written in PostgreSQL — `FILTER (WHERE …)`,
 * `::date`, `DATE_TRUNC`, `EXTRACT(EPOCH …)` — while docker-compose provisions
 * MySQL 8.4 and phpunit forces the mysql connection. It had never once returned
 * data in this environment, and the Dashboard sat in a loading skeleton because
 * of it.
 *
 * Two things are pinned here, because fixing only the first would have left the
 * endpoint broken:
 *   1. the endpoint executes and returns its full contract (the SQL runs), and
 *   2. no PostgreSQL-only construct remains in the source (a regression guard —
 *      the next person to add a `FILTER (WHERE …)` fails here, not in prod).
 *
 * The zero-baseline case is exercised deliberately: an empty tenant is what
 * exposed `trendPct`'s `$previous === 0` guard, which never fired because
 * `0.0 === 0` is false in PHP, so every empty tenant hit a DivisionByZeroError
 * the moment the SQL started working.
 */
class ExecutiveDashboardPortabilityTest extends TestCase
{
    use RefreshDatabase;

    /** Constructs that exist in PostgreSQL and not in MySQL. */
    private const POSTGRES_ONLY = [
        'FILTER (WHERE',
        '::date',
        '::text',
        '::int',
        '::numeric',
        'DATE_TRUNC',
        'EXTRACT(EPOCH',
        'ILIKE',
    ];

    private const GUARDED_FILES = [
        'app/Http/Controllers/ExecutiveDashboardController.php',
        'Modules/System/Engineering/Application/Services/ExecutionSessionService.php',
    ];

    public function test_it_requires_authentication(): void
    {
        $this->getJson('/api/admin/executive-dashboard')->assertUnauthorized();
    }

    public function test_it_returns_the_full_contract_on_an_empty_tenant(): void
    {
        // The regression case. An empty tenant means every "yesterday" baseline
        // is zero, which is exactly what used to throw once the SQL was fixed.
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/admin/executive-dashboard')
            ->assertOk()
            ->assertJsonStructure([
                'sales' => [
                    'revenue_today', 'revenue_yesterday', 'revenue_this_month',
                    'revenue_trend_pct', 'orders_today', 'orders_yesterday',
                    'orders_this_month', 'orders_trend_pct', 'orders_shipped_today',
                    'value_shipped_today', 'aov', 'gross_profit_today',
                    'gross_profit_month', 'pending_count', 'confirmed_count',
                    'preparing_count', 'out_for_delivery', 'delivered_count',
                    'cancelled_today',
                ],
                'marketing' => ['spend_today', 'spend_this_month', 'roas', 'new_customers'],
                'shipping' => ['shipments_today', 'delivered_today', 'cod_pending'],
                'monthly' => ['monthly_revenue', 'monthly_revenue_net', 'monthly_orders'],
                'operations' => ['active_waves', 'active_trips'],
            ]);
    }

    public function test_a_zero_baseline_yields_a_null_trend_rather_than_dividing_by_zero(): void
    {
        $user = User::factory()->create();

        $body = $this->actingAs($user)->getJson('/api/admin/executive-dashboard')->assertOk();

        // No prior-day activity: the trend is unknowable, not 0% and not a crash.
        $this->assertNull($body->json('sales.revenue_trend_pct'));
        $this->assertNull($body->json('sales.orders_trend_pct'));
    }

    public function test_the_connection_under_test_is_the_one_the_platform_deploys(): void
    {
        // If this ever stops being mysql, the portability guarantee above is
        // being asserted against something the platform does not run.
        $this->assertSame('mysql', \DB::connection()->getDriverName());
    }

    public function test_no_postgres_only_syntax_remains(): void
    {
        foreach (self::GUARDED_FILES as $relativePath) {
            $source = File::get(base_path($relativePath));

            // Strip comments so the explanatory docblocks — which name the very
            // constructs being banned — do not trip their own guard.
            $withoutComments = preg_replace('#(/\*.*?\*/)|(//[^\n]*)#s', '', $source) ?? $source;

            foreach (self::POSTGRES_ONLY as $construct) {
                $this->assertStringNotContainsString(
                    $construct,
                    $withoutComments,
                    "{$relativePath} still contains PostgreSQL-only syntax: {$construct}",
                );
            }
        }
    }
}
