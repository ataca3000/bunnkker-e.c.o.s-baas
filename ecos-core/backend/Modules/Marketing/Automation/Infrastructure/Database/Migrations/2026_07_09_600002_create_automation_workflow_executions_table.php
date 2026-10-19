<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_workflow_executions')) {
            return;
        }

        Schema::create('automation_workflow_executions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('workflow_id')->index();
            $table->uuid('workflow_version_id')->nullable();
            $table->string('entity_type', 50)->index();
            $table->string('entity_id', 36)->index();
            $table->string('status', 30)->default('pending')->index();
            $table->string('trigger_type', 30);
            $table->json('trigger_payload')->nullable();
            $table->string('current_node_id', 36)->nullable();
            $table->unsignedInteger('step_count')->default(0);
            $table->string('triggered_by', 36)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });

        DB::statement('CREATE INDEX auto_exec_entity_idx ON automation_workflow_executions (entity_type, entity_id)');
        DB::statement('CREATE INDEX auto_exec_wf_status_idx ON automation_workflow_executions (workflow_id, status)');
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_workflow_executions');
    }
};
