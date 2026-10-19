<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_task_dependencies')) {
            return;
        }

        Schema::create('engineering_task_dependencies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('task_id');
            $table->uuid('depends_on_task_id');
            $table->string('dependency_type', 50)->default('blocks'); // blocks|blocked_by|related
            $table->uuid('created_by_id');
            $table->timestamps();

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->foreign('depends_on_task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->unique(['task_id', 'depends_on_task_id']);
            $table->index(['company_id', 'task_id']);
            $table->index(['depends_on_task_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_dependencies');
    }
};
