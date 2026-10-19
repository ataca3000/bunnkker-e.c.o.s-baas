<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_execution_queue')) {
            return;
        }

        Schema::create('engineering_execution_queue', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('task_id')->index();
            $table->unsignedSmallInteger('priority')->default(500); // 0-1000, higher = more urgent
            $table->string('status', 50)->default('pending'); // pending|assigned|running|paused|cancelled|completed|expired
            $table->string('scheduling_policy', 50)->default('priority'); // fifo|priority|weighted_priority|resource_aware|dependency_aware|reserved
            $table->uuid('assigned_worker_id')->nullable()->index();
            $table->uuid('reserved_worker_id')->nullable(); // manual reservation
            $table->timestamp('earliest_start_at')->nullable(); // for delayed execution
            $table->timestamp('enqueued_at');
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->unsignedSmallInteger('max_retries')->default(3);
            $table->text('cancellation_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status', 'priority']);
            $table->index(['company_id', 'scheduling_policy']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_execution_queue');
    }
};
