<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * HR & Workforce OS — EPIC H1. Permissions and the default employment types.
 *
 * Employment types are seeded per existing company so a fresh install has a
 * usable list; the seed is idempotent and never overwrites what an administrator
 * has already changed.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['hr.workforce.view', 'workforce', 'view', 'View departments, positions, job grades and employment types'],
        ['hr.workforce.manage', 'workforce', 'manage', 'Manage departments, positions, job grades and employment types'],
        ['hr.employees.view', 'employees', 'view', 'View employees and the Employee 360 workspace'],
        ['hr.employees.manage', 'employees', 'manage', 'Create, update, transfer and terminate employees'],
        ['hr.contracts.view', 'contracts', 'view', 'View employment contracts'],
        ['hr.contracts.manage', 'contracts', 'manage', 'Issue, activate and terminate employment contracts'],
        ['hr.org.view', 'org', 'view', 'View the organisation chart and reporting lines'],
        ['hr.org.manage', 'org', 'manage', 'Manage reporting lines'],
    ];

    /** code, name, description */
    private const EMPLOYMENT_TYPES = [
        ['full_time', 'Full Time', 'Permanent, full working week'],
        ['part_time', 'Part Time', 'Reduced working week'],
        ['contractor', 'Contractor', 'Engaged under a service contract'],
        ['temporary', 'Temporary', 'Fixed, short-term engagement'],
        ['seasonal', 'Seasonal', 'Engaged for a peak season'],
    ];

    public function up(): void
    {
        if (Schema::hasTable('permissions')) {
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

        if (! Schema::hasTable('hr_employment_types') || ! Schema::hasTable('companies')) {
            return;
        }

        foreach (DB::table('companies')->pluck('id') as $companyId) {
            foreach (self::EMPLOYMENT_TYPES as [$code, $name, $description]) {
                $exists = DB::table('hr_employment_types')
                    ->where('company_id', $companyId)->where('code', $code)->exists();

                if ($exists) {
                    continue;
                }

                DB::table('hr_employment_types')->insert([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'code' => $code, 'name' => $name, 'description' => $description,
                    'is_active' => true,
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

        if (Schema::hasTable('hr_employment_types')) {
            DB::table('hr_employment_types')->whereIn('code', array_column(self::EMPLOYMENT_TYPES, 0))->delete();
        }
    }
};
