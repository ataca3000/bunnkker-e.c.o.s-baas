<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cb_tasks')) {
            return;
        }

        Schema::create('cb_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('created_by_user_id');
            $table->string('title', 500);
            $table->text('description');
            $table->string('repository_path', 500);
            $table->string('target_branch', 100)->default('main');
            $table->enum('status', [
                'draft',
                'pending',
                'queued',
                'running',
                'done',
                'failed',
                'approved',
                'changes_requested',
                'merged',
                'cancelled',
            ])->default('pending');
            $table->enum('priority', ['low', 'normal', 'high'])->default('normal');
            $table->uuid('worker_id')->nullable();
            $table->text('failure_reason')->nullable();
            $table->text('review_comment')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index('company_id', 'idx_cb_tasks_company');
            $table->index('status', 'idx_cb_tasks_status');
            $table->index('created_by_user_id', 'idx_cb_tasks_created_by');
            $table->index('worker_id', 'idx_cb_tasks_worker');
            $table->index('created_at', 'idx_cb_tasks_created_at');
            $table->index(['status', 'priority', 'created_at'], 'idx_cb_tasks_queue');

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('worker_id')->references('id')->on('cb_workers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cb_tasks');
    }
};
