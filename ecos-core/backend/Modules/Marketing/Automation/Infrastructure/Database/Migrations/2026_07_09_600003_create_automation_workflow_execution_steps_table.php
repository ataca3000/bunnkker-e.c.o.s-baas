<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_workflow_execution_steps')) {
            return;
        }

        Schema::create('automation_workflow_execution_steps', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('execution_id')->index();
            $table->string('node_id', 100);
            $table->string('node_type', 30);
            $table->string('action_type', 50)->nullable();
            $table->string('status', 30);
            $table->json('input')->nullable();
            $table->json('output')->nullable();
            $table->text('error')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamp('executed_at');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_workflow_execution_steps');
    }
};
