<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * HR & Workforce OS — EPIC H5 + H6. Permissions and the default pipeline.
 *
 * The permission split reflects four different jobs: recruiters run the pipeline,
 * HR executes the hire and owns the lifecycle, department managers interview and
 * decide, and executives only ever look.
 *
 * The default stages are seeded so a company can start immediately; they are
 * ordinary rows and can be renamed, reordered or replaced.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // Recruitment
        ['hr.recruitment.view', 'recruitment', 'view', 'View job openings, applicants and the pipeline'],
        ['hr.recruitment.manage', 'recruitment', 'manage', 'Manage job openings, pipeline stages and applicants'],
        ['hr.recruitment.decide', 'recruitment', 'decide', 'Move applications through stages and record decisions'],
        ['hr.interviews.manage', 'interviews', 'manage', 'Schedule interviews and record their outcome'],
        ['hr.hiring.execute', 'hiring', 'execute', 'Hire an accepted applicant and create their employee record'],
        ['hr.lifecycle.manage', 'lifecycle', 'manage', 'Record transfers, promotions and terminations'],

        // Executive intelligence
        ['hr.executive.view', 'executive', 'view', 'View the HR executive dashboard'],
        ['hr.analytics.view', 'analytics', 'view', 'View workforce analytics and trends'],
    ];

    /** code, name, sequence, type, is_initial, is_terminal */
    private const STAGES = [
        ['applied', 'Applied', 1, 'applied', true, false],
        ['initial_review', 'Initial Review', 2, 'screening', false, false],
        ['phone_interview', 'Phone Interview', 3, 'interview', false, false],
        ['interview', 'Interview', 4, 'interview', false, false],
        ['final_interview', 'Final Interview', 5, 'interview', false, false],
        ['offer', 'Offer', 6, 'offer', false, false],
        ['accepted', 'Accepted', 7, 'decision', false, true],
        ['rejected', 'Rejected', 8, 'decision', false, true],
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

        if (! Schema::hasTable('hr_recruitment_stages') || ! Schema::hasTable('companies')) {
            return;
        }

        foreach (DB::table('companies')->pluck('id') as $companyId) {
            foreach (self::STAGES as [$code, $name, $sequence, $type, $isInitial, $isTerminal]) {
                $exists = DB::table('hr_recruitment_stages')
                    ->where('company_id', $companyId)->where('code', $code)->exists();

                if ($exists) {
                    continue;
                }

                DB::table('hr_recruitment_stages')->insert([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'code' => $code, 'name' => $name, 'sequence' => $sequence, 'type' => $type,
                    'is_initial' => $isInitial, 'is_terminal' => $isTerminal, 'is_active' => true,
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

        if (Schema::hasTable('hr_recruitment_stages')) {
            DB::table('hr_recruitment_stages')->whereIn('code', array_column(self::STAGES, 0))->delete();
        }
    }
};
