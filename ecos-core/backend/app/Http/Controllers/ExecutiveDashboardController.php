<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Single-endpoint executive dashboard aggregator.
 *
 * Returns Sales, Marketing, Shipping, and Operations KPIs in one request,
 * designed to load in <500ms so the dashboard renders without skeleton states.
 *
 * ┌─ PORTABILITY (TASK-GL-HOTFIX-001) ────────────────────────────────────────┐
 * │ Every query here is written against the SQL the platform actually         │
 * │ deploys. It previously used PostgreSQL-only syntax — `FILTER (WHERE …)`,  │
 * │ `::date` casts, `DATE_TRUNC` and `EXTRACT(EPOCH …)` — while docker-compose│
 * │ provisions MySQL 8.4 and phpunit forces the mysql connection. Every       │
 * │ request 500'd with SQLSTATE 42000, so this endpoint had never returned    │
 * │ data on the only database the platform runs on.                           │
 * │                                                                            │
 * │ The replacements are ANSI where an ANSI form exists:                       │
 * │   FILTER (WHERE c)        → COUNT/SUM/AVG(CASE WHEN c THEN … END)          │
 * │   x::date = CURRENT_DATE  → half-open range on x (also index-sargable,     │
 * │                             which casting the column never was)            │
 * │   CURRENT_DATE - 1        → CURRENT_DATE - INTERVAL '1' DAY                │
 * │   DATE_TRUNC('month', x)  → half-open range on bounds computed in PHP      │
 * │   EXTRACT(EPOCH FROM a-b) → TIMESTAMPDIFF(MINUTE, b, a)                    │
 * │                                                                            │
 * │ TIMESTAMPDIFF is the one construct with no portable equivalent; it is      │
 * │ MySQL/MariaDB syntax and is marked at its call site.                       │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
final class ExecutiveDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $companyId = $user->company_id;

        return response()->json([
            'sales' => $this->salesKpis($companyId),
            'marketing' => $this->marketingKpis($companyId),
            'shipping' => $this->shippingKpis($companyId),
            'monthly' => $this->monthlyPerformance($companyId),
            'operations' => $this->operationsSnapshot($companyId),
        ]);
    }

    // ── Date boundaries ───────────────────────────────────────────────────────

    /**
     * The current month as a half-open range, as `Y-m-d` strings.
     *
     * These are emitted into SQL as literals rather than bound parameters. They
     * are derived solely from the server clock via Carbon and can only ever be
     * `Y-m-d` — no request data reaches them, so there is no injection surface.
     * Binding them instead would mean repeating the same positional placeholder
     * a dozen times across one SELECT list, where a single mis-ordered binding
     * silently returns wrong figures rather than failing.
     *
     * @return array{0: string, 1: string} [month start, next month start)
     */
    private function monthBounds(): array
    {
        $start = Carbon::now()->startOfMonth();

        return [$start->toDateString(), $start->copy()->addMonth()->toDateString()];
    }

    /** Today as a half-open range: `>= CURRENT_DATE` and `< tomorrow`. */
    private const TODAY = "%s >= CURRENT_DATE AND %s < CURRENT_DATE + INTERVAL '1' DAY";

    /** Yesterday as a half-open range. */
    private const YESTERDAY = "%s >= CURRENT_DATE - INTERVAL '1' DAY AND %s < CURRENT_DATE";

    /** Builds `col >= CURRENT_DATE AND col < …` for one column. */
    private function today(string $column): string
    {
        return sprintf(self::TODAY, $column, $column);
    }

    private function yesterday(string $column): string
    {
        return sprintf(self::YESTERDAY, $column, $column);
    }

    /** Builds a half-open month-range predicate for one column. */
    private function inMonth(string $column, string $from, string $to): string
    {
        return sprintf("%s >= '%s' AND %s < '%s'", $column, $from, $column, $to);
    }

    // ── Sales ────────────────────────────────────────────────────────────────

    private function salesKpis(?string $companyId): array
    {
        $bindings = [];
        $where = 'deleted_at IS NULL';

        if ($companyId !== null) {
            $where .= ' AND company_id = ?';
            $bindings[] = $companyId;
        }

        [$monthFrom, $monthTo] = $this->monthBounds();

        $createdToday = $this->today('created_at');
        $createdYesterday = $this->yesterday('created_at');
        $createdThisMonth = $this->inMonth('created_at', $monthFrom, $monthTo);
        $shippedToday = $this->today('inventory_shipped_at');

        $row = DB::selectOne("
            SELECT
                -- Order counts
                COUNT(CASE WHEN {$createdToday}     THEN 1 END) AS orders_today,
                COUNT(CASE WHEN {$createdYesterday} THEN 1 END) AS orders_yesterday,
                COUNT(CASE WHEN {$createdThisMonth} THEN 1 END) AS orders_this_month,

                -- Revenue
                COALESCE(SUM(CASE WHEN {$createdToday}     THEN total END), 0) AS revenue_today,
                COALESCE(SUM(CASE WHEN {$createdYesterday} THEN total END), 0) AS revenue_yesterday,
                COALESCE(SUM(CASE WHEN {$createdThisMonth} THEN total END), 0) AS revenue_this_month,

                -- Shipped orders
                COUNT(CASE WHEN {$shippedToday} THEN 1 END)                    AS orders_shipped_today,
                COALESCE(SUM(CASE WHEN {$shippedToday} THEN total END), 0)     AS value_shipped_today,

                -- Gross profit (when available from FIFO costing)
                COALESCE(SUM(CASE WHEN {$createdToday}     THEN actual_margin_amount END), 0) AS gross_profit_today,
                COALESCE(SUM(CASE WHEN {$createdThisMonth} THEN actual_margin_amount END), 0) AS gross_profit_month,

                -- Pipeline counts
                COUNT(CASE WHEN status = 'pending'          THEN 1 END) AS pending_count,
                COUNT(CASE WHEN status = 'confirmed'        THEN 1 END) AS confirmed_count,
                COUNT(CASE WHEN status = 'preparing'        THEN 1 END) AS preparing_count,
                COUNT(CASE WHEN status = 'out_for_delivery' THEN 1 END) AS out_for_delivery_count,
                COUNT(CASE WHEN status = 'delivered'        THEN 1 END) AS delivered_count,
                COUNT(CASE WHEN status = 'cancelled' AND {$createdToday} THEN 1 END) AS cancelled_today
            FROM orders
            WHERE {$where}
        ", $bindings);

        $ordersToday = (int) ($row?->orders_today ?? 0);
        $ordersYesterday = (int) ($row?->orders_yesterday ?? 0);
        $revenueToday = (float) ($row?->revenue_today ?? 0);
        $revenueYday = (float) ($row?->revenue_yesterday ?? 0);
        $ordersMonth = (int) ($row?->orders_this_month ?? 0);
        $aov = $ordersToday > 0 ? round($revenueToday / $ordersToday, 2) : 0;

        return [
            'revenue_today' => round($revenueToday, 2),
            'revenue_yesterday' => round($revenueYday, 2),
            'revenue_this_month' => round((float) ($row?->revenue_this_month ?? 0), 2),
            'revenue_trend_pct' => $this->trendPct($revenueToday, $revenueYday),
            'orders_today' => $ordersToday,
            'orders_yesterday' => $ordersYesterday,
            'orders_this_month' => $ordersMonth,
            'orders_trend_pct' => $this->trendPct($ordersToday, $ordersYesterday),
            'orders_shipped_today' => (int) ($row?->orders_shipped_today ?? 0),
            'value_shipped_today' => round((float) ($row?->value_shipped_today ?? 0), 2),
            'aov' => $aov,
            'gross_profit_today' => round((float) ($row?->gross_profit_today ?? 0), 2),
            'gross_profit_month' => round((float) ($row?->gross_profit_month ?? 0), 2),
            // Pipeline
            'pending_count' => (int) ($row?->pending_count ?? 0),
            'confirmed_count' => (int) ($row?->confirmed_count ?? 0),
            'preparing_count' => (int) ($row?->preparing_count ?? 0),
            'out_for_delivery' => (int) ($row?->out_for_delivery_count ?? 0),
            'delivered_count' => (int) ($row?->delivered_count ?? 0),
            'cancelled_today' => (int) ($row?->cancelled_today ?? 0),
        ];
    }

    // ── Marketing ────────────────────────────────────────────────────────────

    private function marketingKpis(?string $companyId): array
    {
        try {
            $bindings = [];
            $cWhere = '1=1';

            if ($companyId !== null) {
                $cWhere .= ' AND c.company_id = ?';
                $bindings[] = $companyId;
            }

            [$monthFrom, $monthTo] = $this->monthBounds();

            // `date_start` is a DATE column, so today/yesterday compare directly.
            $dToday = 'ins.date_start = CURRENT_DATE';
            $dYesterday = "ins.date_start = CURRENT_DATE - INTERVAL '1' DAY";
            $dMonth = $this->inMonth('ins.date_start', $monthFrom, $monthTo);

            $row = DB::selectOne("
                SELECT
                    COALESCE(SUM(CASE WHEN {$dToday}     THEN ins.spend END), 0)          AS spend_today,
                    COALESCE(SUM(CASE WHEN {$dYesterday} THEN ins.spend END), 0)          AS spend_yesterday,
                    COALESCE(SUM(CASE WHEN {$dMonth}     THEN ins.spend END), 0)          AS spend_this_month,
                    COALESCE(SUM(CASE WHEN {$dMonth}     THEN ins.purchase_value END), 0) AS revenue_this_month,
                    COALESCE(SUM(CASE WHEN {$dMonth}     THEN ins.purchases END), 0)      AS purchases_month,
                    COALESCE(SUM(CASE WHEN {$dMonth}     THEN ins.clicks END), 0)         AS clicks_month,
                    COALESCE(SUM(CASE WHEN {$dMonth}     THEN ins.impressions END), 0)    AS impressions_month,
                    COALESCE(SUM(CASE WHEN {$dMonth}     THEN ins.leads END), 0)          AS leads_month,
                    COALESCE(SUM(CASE WHEN {$dYesterday} THEN ins.spend END), 0)          AS spend_trend_base
                FROM marketing_campaign_insights ins
                JOIN marketing_campaigns c ON c.id = ins.marketing_campaign_id
                WHERE ins.level = 'campaign' AND {$cWhere}
            ", $bindings);

            $spendToday = (float) ($row?->spend_today ?? 0);
            $spendYday = (float) ($row?->spend_yesterday ?? 0);
            $revenueMonth = (float) ($row?->revenue_this_month ?? 0);
            $spendMonth = (float) ($row?->spend_this_month ?? 0);
            $purchases = (int) ($row?->purchases_month ?? 0);
            $clicks = (int) ($row?->clicks_month ?? 0);
            $impressions = (int) ($row?->impressions_month ?? 0);

            $roas = $spendMonth > 0 ? round($revenueMonth / $spendMonth, 2) : null;
            $cac = $purchases > 0 ? round($spendMonth / $purchases, 2) : null;
            $conversionRate = $clicks > 0 ? round(($purchases / $clicks) * 100, 2) : null;

            // New vs returning customers from orders linked to marketing month
            $customerRow = null;
            if ($companyId !== null) {
                $seenBefore = "EXISTS (
                    SELECT 1 FROM orders o2
                    WHERE o2.customer_id = o.customer_id
                      AND o2.deleted_at IS NULL
                      AND o2.created_at < '{$monthFrom}'
                )";

                $customerRow = DB::selectOne("
                    SELECT
                        COUNT(DISTINCT CASE WHEN NOT {$seenBefore} THEN o.customer_id END) AS new_customers,
                        COUNT(DISTINCT CASE WHEN     {$seenBefore} THEN o.customer_id END) AS returning_customers
                    FROM orders o
                    WHERE o.deleted_at IS NULL
                      AND o.company_id = ?
                      AND {$this->inMonth('o.created_at', $monthFrom, $monthTo)}
                ", [$companyId]);
            }

            return [
                'spend_today' => round($spendToday, 2),
                'spend_yesterday' => round($spendYday, 2),
                'spend_this_month' => round($spendMonth, 2),
                'spend_trend_pct' => $this->trendPct($spendToday, $spendYday),
                'campaign_revenue' => round($revenueMonth, 2),
                'roas' => $roas,
                'cac' => $cac,
                'conversion_rate' => $conversionRate,
                'purchases_month' => $purchases,
                'impressions_month' => $impressions,
                'new_customers' => (int) ($customerRow?->new_customers ?? 0),
                'returning_customers' => (int) ($customerRow?->returning_customers ?? 0),
            ];
        } catch (Throwable) {
            // Marketing tables may not exist on all environments
            return [
                'spend_today' => 0, 'spend_yesterday' => 0,
                'spend_this_month' => 0, 'spend_trend_pct' => null,
                'campaign_revenue' => 0, 'roas' => null,
                'cac' => null, 'conversion_rate' => null,
                'purchases_month' => 0, 'impressions_month' => 0,
                'new_customers' => 0, 'returning_customers' => 0,
            ];
        }
    }

    // ── Shipping ─────────────────────────────────────────────────────────────

    private function shippingKpis(?string $companyId): array
    {
        try {
            $bindings = [];
            $dtWhere = '1=1';

            if ($companyId !== null) {
                $dtWhere .= ' AND dt.company_id = ?';
                $bindings[] = $companyId;
            }

            $completedToday = $this->today('dds.completed_at');
            $completedYesterday = $this->yesterday('dds.completed_at');

            $row = DB::selectOne("
                SELECT
                    COUNT(*)                                                                   AS stops_with_activity,
                    COUNT(CASE WHEN {$completedToday} THEN 1 END)                              AS shipments_today,
                    COUNT(CASE WHEN dds.status = 'delivered' AND {$completedToday} THEN 1 END) AS delivered_today,
                    COUNT(CASE WHEN dds.status = 'failed'    AND {$completedToday} THEN 1 END) AS failed_today,
                    COUNT(CASE WHEN dds.status = 'returned'  AND {$completedToday} THEN 1 END) AS returns_today,
                    COALESCE(SUM(CASE WHEN {$completedToday} THEN dds.collected_amount END), 0)          AS cod_collected_today,
                    COALESCE(SUM(CASE WHEN dds.status = 'pending' THEN dds.collected_amount END), 0)     AS cod_pending,
                    -- Shipping revenue = sum of collected_amount for delivered stops today
                    COALESCE(SUM(CASE WHEN dds.status = 'delivered' AND {$completedToday}     THEN dds.collected_amount END), 0) AS shipping_revenue_today,
                    COALESCE(SUM(CASE WHEN dds.status = 'delivered' AND {$completedYesterday} THEN dds.collected_amount END), 0) AS shipping_revenue_yesterday,
                    -- Average delivery time in minutes. TIMESTAMPDIFF is MySQL/MariaDB —
                    -- there is no ANSI equivalent for an interval-to-scalar conversion.
                    AVG(CASE
                        WHEN dds.status = 'delivered'
                         AND dds.completed_at IS NOT NULL
                         AND dt.departure_at IS NOT NULL
                        THEN TIMESTAMPDIFF(MINUTE, dt.departure_at, dds.completed_at)
                    END) AS avg_delivery_minutes
                FROM driver_delivery_stops dds
                JOIN distribution_trips dt ON dt.id = dds.distribution_trip_id
                WHERE {$dtWhere}
            ", $bindings);

            return [
                'shipments_today' => (int) ($row?->shipments_today ?? 0),
                'delivered_today' => (int) ($row?->delivered_today ?? 0),
                'failed_today' => (int) ($row?->failed_today ?? 0),
                'returns_today' => (int) ($row?->returns_today ?? 0),
                'shipping_revenue_today' => round((float) ($row?->shipping_revenue_today ?? 0), 2),
                'shipping_revenue_yesterday' => round((float) ($row?->shipping_revenue_yesterday ?? 0), 2),
                'cod_collected_today' => round((float) ($row?->cod_collected_today ?? 0), 2),
                'cod_pending' => round((float) ($row?->cod_pending ?? 0), 2),
                'avg_delivery_minutes' => $row?->avg_delivery_minutes !== null
                    ? round((float) $row->avg_delivery_minutes, 0)
                    : null,
            ];
        } catch (Throwable) {
            return [
                'shipments_today' => 0, 'delivered_today' => 0, 'failed_today' => 0,
                'returns_today' => 0, 'shipping_revenue_today' => 0,
                'shipping_revenue_yesterday' => 0, 'cod_collected_today' => 0,
                'cod_pending' => 0, 'avg_delivery_minutes' => null,
            ];
        }
    }

    // ── Monthly Performance ───────────────────────────────────────────────────

    private function monthlyPerformance(?string $companyId): array
    {
        [$monthFrom, $monthTo] = $this->monthBounds();

        $bindings = [];
        $where = 'deleted_at IS NULL AND '.$this->inMonth('created_at', $monthFrom, $monthTo);

        if ($companyId !== null) {
            $where .= ' AND company_id = ?';
            $bindings[] = $companyId;
        }

        $row = DB::selectOne("
            SELECT
                COALESCE(SUM(total), 0) AS monthly_revenue,
                COUNT(*)                AS monthly_orders,
                COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'returned') THEN total END), 0) AS monthly_revenue_net
            FROM orders
            WHERE {$where}
        ", $bindings);

        // Revenue target: no target table exists yet — return null so the UI shows a "--" state
        return [
            'monthly_revenue' => round((float) ($row?->monthly_revenue ?? 0), 2),
            'monthly_revenue_net' => round((float) ($row?->monthly_revenue_net ?? 0), 2),
            'monthly_orders' => (int) ($row?->monthly_orders ?? 0),
            'revenue_target' => null, // no target table yet
            'progress_pct' => null,
        ];
    }

    // ── Operations Snapshot ───────────────────────────────────────────────────

    private function operationsSnapshot(?string $companyId): array
    {
        try {
            $wWhere = "deleted_at IS NULL AND status NOT IN ('completed', 'cancelled')";
            $tWhere = "status IN ('out_for_delivery', 'dispatched')";
            $companyBinding = [];

            if ($companyId !== null) {
                $wWhere .= ' AND company_id = ?';
                $tWhere .= ' AND company_id = ?';
                $companyBinding = [$companyId];
            }

            // Each statement carries its own binding list. The previous version
            // sliced one shared array by offset, which only held because both
            // queries happened to take exactly one parameter.
            $wavesRow = DB::selectOne(
                "SELECT COUNT(*) AS active_waves FROM preparation_waves WHERE {$wWhere}",
                $companyBinding,
            );

            $tripsRow = DB::selectOne(
                "SELECT COUNT(*) AS active_trips FROM distribution_trips WHERE {$tWhere}",
                $companyBinding,
            );

            return [
                'active_waves' => (int) ($wavesRow?->active_waves ?? 0),
                'active_trips' => (int) ($tripsRow?->active_trips ?? 0),
            ];
        } catch (Throwable) {
            return ['active_waves' => 0, 'active_trips' => 0];
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Percentage change, or null when there is no meaningful baseline.
     *
     * The zero guard compares against `0.0`, not `0`. `$previous` is always a
     * float, and `0.0 === 0` is false in PHP — so the original guard never fired
     * and every empty-baseline call reached `/ abs(0.0)` and threw
     * DivisionByZeroError. It went unseen only because the PostgreSQL syntax in
     * the queries above threw first; fixing those exposed it on the very next
     * request, on any tenant with no prior-day activity.
     */
    private function trendPct(float $current, float $previous): ?float
    {
        if ($previous === 0.0) {
            return $current > 0 ? 100.0 : null;
        }

        return round((($current - $previous) / abs($previous)) * 100, 1);
    }
}
