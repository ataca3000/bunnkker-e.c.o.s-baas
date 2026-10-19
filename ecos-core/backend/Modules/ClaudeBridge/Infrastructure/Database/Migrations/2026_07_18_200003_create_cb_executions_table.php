<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cb_executions')) {
            return;
        }

        Schema::create('cb_executions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->uuid('worker_id');
            $table->smallInteger('attempt_number')->default(1);
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->smallInteger('exit_code')->nullable();
            $table->integer('tokens_used')->nullable();
            $table->string('claude_version', 50)->nullable();
            $table->string('failure_code', 50)->nullable();
            $table->text('failure_message')->nullable();
            $table->integer('duration_seconds')->nullable();

            $table->index('task_id', 'idx_cb_executions_task');
            $table->index('worker_id', 'idx_cb_executions_worker');

            $table->foreign('task_id')->references('id')->on('cb_tasks')->cascadeOnDelete();
            $table->foreign('worker_id')->references('id')->on('cb_workers')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cb_executions');
    }
};
