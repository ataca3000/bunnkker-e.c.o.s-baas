<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cb_artifacts')) {
            return;
        }

        Schema::create('cb_artifacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->uuid('execution_id');
            $table->enum('type', ['diff', 'report', 'log']);
            $table->string('filename', 255);
            $table->string('storage_path', 500);
            $table->integer('size_bytes');
            $table->char('checksum_sha256', 64);
            $table->timestamp('created_at')->useCurrent();

            $table->index('task_id', 'idx_cb_artifacts_task');
            $table->index('execution_id', 'idx_cb_artifacts_execution');
            $table->index('type', 'idx_cb_artifacts_type');

            $table->foreign('task_id')->references('id')->on('cb_tasks')->cascadeOnDelete();
            $table->foreign('execution_id')->references('id')->on('cb_executions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cb_artifacts');
    }
};
