<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_execution_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('task_id');
            $table->uuid('agent_id');
            $table->string('status', 50)->default('initializing');
            $table->string('workspace_path', 1000)->nullable();
            $table->string('git_branch', 255)->nullable();
            $table->string('git_commit', 40)->nullable();
            $table->unsignedSmallInteger('progress_percent')->default(0);
            $table->text('progress_message')->nullable();
            $table->integer('cpu_seconds_used')->nullable();
            $table->integer('memory_mb_peak')->nullable();
            $table->decimal('disk_gb_peak', 8, 2)->nullable();
            $table->text('failure_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('resumed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('aborted_at')->nullable();
            $table->timestamps();

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->foreign('agent_id')
                ->references('id')
                ->on('engineering_agents')
                ->cascadeOnDelete();

            $table->index(['company_id', 'status']);
            $table->index(['agent_id', 'status']);
            $table->index('task_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_execution_sessions');
    }
};
