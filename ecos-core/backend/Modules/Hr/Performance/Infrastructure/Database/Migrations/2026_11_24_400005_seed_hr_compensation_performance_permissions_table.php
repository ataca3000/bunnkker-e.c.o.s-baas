<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * HR & Workforce OS — EPIC H3 + H4. The permission matrix.
 *
 * Viewing compensation, changing it and APPROVING it are three different
 * permissions on purpose — the person who enters a deduction should not be the
 * person who signs it off, and neither necessarily runs payroll.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // H3 — Compensation
        ['hr.compensation.view', 'compensation', 'view', 'View payroll periods, payslips and Compensation 360'],
        ['hr.compensation.manage', 'compensation', 'manage', 'Manage salary structures, bonuses, deductions and advances'],
        ['hr.compensation.calculate', 'compensation', 'calculate', 'Run the compensation calculation for a period'],
        ['hr.compensation.approve', 'compensation', 'approve', 'Approve deductions, advances and payroll runs'],
        ['hr.commission.view', 'commission', 'view', 'View commission rules'],
        ['hr.commission.manage', 'commission', 'manage', 'Configure commission rules and tiers'],

        // H4 — Performance
        ['hr.performance.view', 'performance', 'view', 'View goals, KPIs, dashboards and performance history'],
        ['hr.performance.manage', 'performance', 'manage', 'Set goals and record incidents'],
        ['hr.performance.review', 'performance', 'review', 'Submit manager reviews and decide bonus recommendations'],
        ['hr.kpi.ingest', 'kpi', 'ingest', 'Record operational KPI facts for the workforce'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $resource, $action, $description]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            DB::table('permissions')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name, 'module' => 'hr', 'resource' => $resource,
                'action' => $action, 'description' => $description,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        DB::table('permissions')->whereIn('name', array_column(self::PERMISSIONS, 0))->delete();
    }
};
