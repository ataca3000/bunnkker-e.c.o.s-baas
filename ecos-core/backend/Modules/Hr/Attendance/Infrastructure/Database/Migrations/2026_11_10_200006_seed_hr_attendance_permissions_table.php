<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * HR & Workforce OS — EPIC H2. Permissions, a default work calendar and the Eids.
 *
 * Eid Al-Fitr and Eid Al-Adha follow the lunar calendar, so their Gregorian dates
 * move roughly eleven days earlier each year and cannot be derived. The seed
 * records the observed 2026 dates as a starting point; HR maintains them from the
 * holidays screen thereafter.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['hr.attendance.view', 'attendance', 'view', 'View attendance, calendars, shifts and workforce availability'],
        ['hr.attendance.register', 'attendance', 'register', 'Register daily attendance and manage calendars, shifts and holidays'],
        ['hr.leave.view', 'leave', 'view', 'View leave requests'],
        ['hr.leave.request', 'leave', 'request', 'Submit and cancel leave requests'],
        ['hr.leave.approve', 'leave', 'approve', 'Approve or reject leave requests'],
    ];

    /** name, start, end, type — observed 2026 dates, maintained by HR thereafter. */
    private const HOLIDAYS = [
        ['Eid Al-Fitr', '2026-03-20', '2026-03-22', 'religious'],
        ['Eid Al-Adha', '2026-05-27', '2026-05-30', 'religious'],
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

        if (! Schema::hasTable('companies')) {
            return;
        }

        foreach (DB::table('companies')->pluck('id') as $companyId) {
            $this->seedCalendar((string) $companyId);
            $this->seedHolidays((string) $companyId);
        }
    }

    private function seedCalendar(string $companyId): void
    {
        if (! Schema::hasTable('hr_work_calendars')) {
            return;
        }

        if (DB::table('hr_work_calendars')->where('company_id', $companyId)->where('code', 'standard')->exists()) {
            return;
        }

        DB::table('hr_work_calendars')->insert([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            'code' => 'standard',
            'name' => 'Standard Week',
            // Sunday through Thursday, the common working week in the region.
            'working_days' => json_encode([7, 1, 2, 3, 4]),
            'default_start_time' => '09:00:00',
            'default_end_time' => '17:00:00',
            'is_default' => true,
            'is_active' => true,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function seedHolidays(string $companyId): void
    {
        if (! Schema::hasTable('hr_official_holidays')) {
            return;
        }

        foreach (self::HOLIDAYS as [$name, $start, $end, $type]) {
            $exists = DB::table('hr_official_holidays')
                ->where('company_id', $companyId)->where('name', $name)->where('start_date', $start)->exists();

            if ($exists) {
                continue;
            }

            DB::table('hr_official_holidays')->insert([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $name, 'start_date' => $start, 'end_date' => $end, 'type' => $type,
                'notes' => 'Lunar calendar — confirm the observed dates each year.',
                'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            DB::table('permissions')->whereIn('name', array_column(self::PERMISSIONS, 0))->delete();
        }

        if (Schema::hasTable('hr_official_holidays')) {
            DB::table('hr_official_holidays')->whereIn('name', array_column(self::HOLIDAYS, 0))->delete();
        }

        if (Schema::hasTable('hr_work_calendars')) {
            DB::table('hr_work_calendars')->where('code', 'standard')->delete();
        }
    }
};
