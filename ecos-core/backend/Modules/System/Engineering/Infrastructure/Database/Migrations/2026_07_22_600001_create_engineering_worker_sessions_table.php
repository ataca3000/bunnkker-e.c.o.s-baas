<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_worker_sessions')) {
            return;
        }

        Schema::create('engineering_worker_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('worker_id')->index();
            $table->uuid('task_id')->index();
            $table->string('status', 50)->default('preparing'); // preparing|running|paused|completing|completed|failed|aborted
            $table->string('workspace_path', 1000)->nullable();
            $table->string('git_branch', 255)->nullable();
            $table->string('git_commit_before', 40)->nullable();
            $table->string('git_commit_after', 40)->nullable();
            $table->unsignedSmallInteger('progress_percent')->default(0);
            $table->text('progress_message')->nullable();
            $table->text('failure_reason')->nullable();
            $table->unsignedInteger('cpu_seconds_used')->nullable();
            $table->unsignedInteger('memory_mb_peak')->nullable();
            $table->decimal('disk_gb_peak', 8, 2)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('resumed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('aborted_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status']);
            $table->index(['worker_id', 'status']);

            $table->foreign('worker_id')->references('id')->on('engineering_workers');
            $table->foreign('task_id')->references('id')->on('engineering_tasks');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_worker_sessions');
    }
};
