<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_guardian_runs')) {
            return;
        }

        Schema::create('engineering_guardian_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('trigger_source')->default('manual'); // pre_commit|pipeline|manual|api
            $table->string('commit_ref')->nullable();
            $table->string('branch')->nullable();
            $table->uuid('initiated_by')->nullable();
            $table->string('status')->default('pending');
            $table->string('decision')->nullable(); // allow|block
            $table->json('changed_files')->nullable();
            $table->json('diff_stats')->nullable();
            $table->unsignedInteger('total_checks')->default(0);
            $table->unsignedInteger('failed_checks_count')->default(0);
            $table->uuid('repair_session_id')->nullable();
            $table->uuid('validation_id')->nullable();
            $table->uuid('policy_id')->nullable();
            $table->uuid('pipeline_run_id')->nullable();
            $table->text('decision_reason')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index('company_id');
            $table->index(['company_id', 'status']);
            $table->index('repair_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_guardian_runs');
    }
};
