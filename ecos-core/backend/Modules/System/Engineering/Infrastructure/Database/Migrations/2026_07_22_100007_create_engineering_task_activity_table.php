<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_task_activity', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->uuid('company_id');
            $table->string('activity_type', 100);
            $table->uuid('causer_id')->nullable();
            $table->string('causer_type', 50)->nullable();
            $table->json('properties')->nullable();
            $table->timestamp('created_at');

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->index(['task_id', 'created_at']);
            $table->index(['company_id', 'activity_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_activity');
    }
};
