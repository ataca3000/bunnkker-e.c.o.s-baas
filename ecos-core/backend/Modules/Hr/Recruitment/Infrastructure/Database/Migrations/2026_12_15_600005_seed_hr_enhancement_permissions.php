<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * HR V1 enhancements — permissions and the default tag catalogue.
 *
 * The new permissions separate acts that carry different weight. Tagging a
 * candidate and moving eighty of them at once are both "recruiting", but one is
 * reversible in a click and the other is not, so bulk work is its own grant.
 * Offers commit the company to a salary, and adjusting approved pay changes what
 * someone is owed after Finance was told — neither belongs inside a general
 * "manage recruitment" or "manage payroll" permission.
 *
 * The tags are seeded from the CTO's own examples so the catalogue is useful on
 * day one. They are ordinary rows: rename them, recolour them, delete them.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['hr.recruitment.tag', 'recruitment', 'tag', 'Add and remove applicant tags'],
        ['hr.recruitment.tags.manage', 'recruitment', 'manage_tags', 'Manage the company applicant tag catalogue'],
        ['hr.recruitment.bulk', 'recruitment', 'bulk', 'Perform bulk actions on multiple applications at once'],
        ['hr.recruitment.analytics.view', 'recruitment', 'view_analytics', 'View recruitment analytics and funnel performance'],
        ['hr.offers.view', 'offers', 'view', 'View offer letters and their version history'],
        ['hr.offers.manage', 'offers', 'manage', 'Draft, revise, send and withdraw offer letters'],
        ['hr.exit.view', 'exit', 'view', 'View employee exit processes and clearance checklists'],
        ['hr.exit.manage', 'exit', 'manage', 'Initiate exits and complete clearance checklist items'],
        ['hr.compensation.adjust', 'compensation', 'adjust', 'Raise adjustments against approved payroll'],
        ['hr.compensation.adjust.approve', 'compensation', 'approve_adjustment', 'Approve or reject compensation adjustments'],
    ];

    /** key, name, colour, sequence, description */
    private const TAGS = [
        ['excellent_candidate', 'Excellent Candidate', 'emerald', 10, 'Stood out clearly against the rest of the pool'],
        ['high_priority', 'High Priority', 'amber', 20, 'Move this candidacy ahead of the queue'],
        ['urgent', 'Urgent', 'red', 30, 'Time-critical — the role cannot wait'],
        ['vip', 'VIP', 'violet', 40, 'Handled personally by senior management'],
        ['referred', 'Referred', 'blue', 50, 'Came in through a referral'],
        ['internal_recommendation', 'Internal Recommendation', 'sky', 60, 'Recommended by a member of staff'],
        ['future_talent', 'Future Talent', 'teal', 70, 'Not for this role — worth keeping in touch with'],
        ['waiting_list', 'Waiting List', 'slate', 80, 'Held pending the outcome of another candidacy'],
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

        if (! Schema::hasTable('hr_applicant_tags') || ! Schema::hasTable('companies')) {
            return;
        }

        foreach (DB::table('companies')->pluck('id') as $companyId) {
            foreach (self::TAGS as [$key, $name, $color, $sequence, $description]) {
                $exists = DB::table('hr_applicant_tags')
                    ->where('company_id', $companyId)->where('key', $key)->exists();

                if ($exists) {
                    continue;
                }

                DB::table('hr_applicant_tags')->insert([
                    'id' => (string) Str::uuid(),
                    'company_id' => $companyId,
                    'key' => $key, 'name' => $name, 'description' => $description,
                    'color' => $color, 'sequence' => $sequence, 'is_active' => true,
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

        if (Schema::hasTable('hr_applicant_tags')) {
            DB::table('hr_applicant_tags')->whereIn('key', array_column(self::TAGS, 0))->delete();
        }
    }
};
