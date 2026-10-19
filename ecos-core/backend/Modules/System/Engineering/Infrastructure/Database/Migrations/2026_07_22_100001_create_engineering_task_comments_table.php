<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_task_comments')) {
            return;
        }

        Schema::create('engineering_task_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->uuid('company_id');
            $table->uuid('author_id');
            $table->text('body');
            $table->boolean('is_system')->default(false);
            $table->boolean('is_internal')->default(false);
            $table->softDeletes();
            $table->timestamps();

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->index(['task_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_comments');
    }
};
