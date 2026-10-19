<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_releases')) { return; }
        Schema::create('engineering_releases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('name');
            $table->string('version')->nullable();
            $table->text('description')->nullable();
            $table->string('status')->default('draft')->index();
            $table->string('release_type')->default('standard');
            $table->json('task_ids')->nullable();
            $table->integer('task_count')->default(0);
            $table->integer('readiness_score')->default(0);
            $table->json('readiness_breakdown')->nullable();
            $table->string('risk_level')->default('low');
            $table->json('risk_factors')->nullable();
            $table->boolean('is_breaking_change')->default(false);
            $table->json('breaking_changes')->nullable();
            $table->string('target_environment')->default('production');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('collected_at')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('pipeline_started_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->string('cancellation_reason')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->uuid('rejected_by')->nullable();
            $table->uuid('cloned_from_id')->nullable();
            $table->string('pipeline_run_id')->nullable();
            $table->string('pipeline_status')->nullable();
            $table->json('metadata')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'created_at']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_releases'); }
};
