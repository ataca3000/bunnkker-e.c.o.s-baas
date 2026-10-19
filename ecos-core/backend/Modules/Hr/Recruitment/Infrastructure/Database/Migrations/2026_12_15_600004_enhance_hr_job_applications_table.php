<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR V1 enhancements — two columns a candidacy was missing.
 *
 * OWNERSHIP: a recruiter is an EMPLOYEE, referenced by id. Nothing about them is
 * copied here, so "recruiter performance" is counted from candidacies and read
 * back through Workforce, which is the only place a person's name lives.
 *
 * ARCHIVING is not rejecting. A candidacy parked because the role was cancelled
 * has not been turned down, and merging the two would make every funnel metric
 * lie. Archived is therefore a mark on the row, not a status, which also means
 * the status machine H5 shipped is untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_job_applications', function (Blueprint $table): void {
            if (! Schema::hasColumn('hr_job_applications', 'recruiter_employee_id')) {
                $table->foreignUuid('recruiter_employee_id')->nullable()
                    ->after('current_stage_id')
                    ->constrained('hr_employees')->nullOnDelete();
            }

            if (! Schema::hasColumn('hr_job_applications', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('decided_by');
            }
        });

        // Named separately so the index survives a partial re-run of the block above.
        Schema::table('hr_job_applications', function (Blueprint $table): void {
            $table->index(['company_id', 'recruiter_employee_id'], 'hr_application_recruiter_idx');
        });
    }

    public function down(): void
    {
        Schema::table('hr_job_applications', function (Blueprint $table): void {
            $table->dropIndex('hr_application_recruiter_idx');

            if (Schema::hasColumn('hr_job_applications', 'recruiter_employee_id')) {
                $table->dropConstrainedForeignId('recruiter_employee_id');
            }

            if (Schema::hasColumn('hr_job_applications', 'archived_at')) {
                $table->dropColumn('archived_at');
            }
        });
    }
};
