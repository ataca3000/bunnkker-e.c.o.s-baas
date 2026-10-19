<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * CRM Customer Intelligence — EPIC C5. Permissions + the system RFM segments.
 *
 * Segments are seeded as system templates (company_id = null) so every tenant
 * shares one explainable taxonomy; they are derived from RFM scores, never
 * hand-assigned.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['crm.intelligence.view', 'intelligence', 'view', 'View customer intelligence, segments, analytics and recommendations'],
        ['crm.intelligence.ingest', 'intelligence', 'ingest', 'Record purchase facts by reference for intelligence'],
        ['crm.intelligence.recompute', 'intelligence', 'recompute', 'Recompute customer intelligence profiles'],
    ];

    /** key, name, description, color, priority, is_retention_focus */
    private const SEGMENTS = [
        ['champions', 'Champions', 'Bought recently, buy often and spend the most.', '#16a34a', 10, false],
        ['loyal_customers', 'Loyal Customers', 'Buy regularly; responsive to programs.', '#22c55e', 20, false],
        ['potential_loyalists', 'Potential Loyalists', 'Recent buyers with average frequency.', '#84cc16', 30, false],
        ['new_customers', 'New Customers', 'Bought recently, but only once.', '#0ea5e9', 40, false],
        ['promising', 'Promising', 'Recent shoppers, low spend so far.', '#38bdf8', 50, false],
        ['need_attention', 'Need Attention', 'Above-average recency/frequency but slipping.', '#f59e0b', 60, true],
        ['about_to_sleep', 'About To Sleep', 'Below-average recency and frequency; will churn.', '#f97316', 70, true],
        ['at_risk', 'At Risk', 'Spent big and often, but long ago.', '#ef4444', 80, true],
        ['cant_lose', "Can't Lose Them", 'Made the biggest purchases, but not for a long time.', '#dc2626', 90, true],
        ['hibernating', 'Hibernating', 'Low spend and frequency, purchased long ago.', '#a855f7', 100, true],
        ['lost', 'Lost', 'Lowest recency, frequency and spend.', '#6b7280', 110, true],
    ];

    public function up(): void
    {
        if (Schema::hasTable('permissions')) {
            foreach (self::PERMISSIONS as [$name, $resource, $action, $description]) {
                if (! DB::table('permissions')->where('name', $name)->exists()) {
                    DB::table('permissions')->insert([
                        'id' => (string) Str::uuid(),
                        'name' => $name, 'module' => 'crm', 'resource' => $resource,
                        'action' => $action, 'description' => $description,
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
            }
        }

        if (Schema::hasTable('crm_customer_segments')) {
            foreach (self::SEGMENTS as [$key, $name, $description, $color, $priority, $retention]) {
                if (DB::table('crm_customer_segments')->whereNull('company_id')->where('key', $key)->exists()) {
                    continue;
                }

                DB::table('crm_customer_segments')->insert([
                    'id' => (string) Str::uuid(),
                    'company_id' => null,
                    'key' => $key, 'name' => $name, 'description' => $description,
                    'color' => $color, 'priority' => $priority,
                    'is_retention_focus' => $retention, 'is_system' => true,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            DB::table('permissions')->whereIn('name', array_column(self::PERMISSIONS, 0))->delete();
        }

        if (Schema::hasTable('crm_customer_segments')) {
            DB::table('crm_customer_segments')->whereNull('company_id')
                ->whereIn('key', array_column(self::SEGMENTS, 0))->delete();
        }
    }
};
