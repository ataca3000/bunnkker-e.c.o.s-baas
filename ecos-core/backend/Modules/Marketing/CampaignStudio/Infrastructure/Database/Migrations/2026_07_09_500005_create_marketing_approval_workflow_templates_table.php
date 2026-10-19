<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_approval_workflow_templates')) {
            return;
        }

        Schema::create('marketing_approval_workflow_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('company_id', 36)->nullable()->index();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();
            $table->timestamps();
        });

        Schema::create('marketing_approval_workflow_steps', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('workflow_template_id')->index();
            $table->unsignedSmallInteger('step_order');
            $table->string('step_name', 255);
            $table->string('role_required', 100)->nullable();
            $table->string('user_id_required', 36)->nullable();
            $table->boolean('requires_all')->default(false);
            $table->boolean('is_optional')->default(false);
            $table->unsignedInteger('timeout_hours')->nullable();
            $table->string('on_timeout_action', 30)->default('escalate');
            $table->timestamps();

            $table->unique(['workflow_template_id', 'step_order'], 'mkt_awf_template_order_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_approval_workflow_steps');
        Schema::dropIfExists('marketing_approval_workflow_templates');
    }
};
