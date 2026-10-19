<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_task_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->uuid('company_id');
            $table->string('event_type', 100);
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50)->nullable();
            $table->uuid('actor_id')->nullable();
            $table->string('actor_type', 20)->nullable()->default('user');
            $table->text('reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->index(['task_id', 'occurred_at']);
            $table->index(['company_id', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_history');
    }
};
