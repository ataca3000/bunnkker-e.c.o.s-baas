<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('automation_workflows')) {
            return;
        }

        Schema::create('automation_workflows', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 500);
            $table->text('description')->nullable();
            $table->string('company_id', 36)->nullable()->index();
            $table->string('brand_id', 36)->nullable()->index();
            $table->string('status', 30)->default('draft')->index();
            $table->string('trigger_type', 30)->index();
            $table->json('nodes_graph');
            $table->unsignedInteger('version_number')->default(1);
            $table->uuid('current_version_id')->nullable();
            $table->uuid('governance_policy_id')->nullable();
            $table->json('tags')->nullable();
            $table->string('created_by', 36);
            $table->string('updated_by', 36);
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->string('approval_status', 30)->nullable();
            $table->string('approved_by', 36)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedBigInteger('execution_count')->default(0);
            $table->timestamp('last_executed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        DB::statement('CREATE INDEX auto_wf_company_status_idx ON automation_workflows (company_id, status)');
        DB::statement('CREATE INDEX auto_wf_trigger_status_idx ON automation_workflows (trigger_type, status)');
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_workflows');
    }
};
