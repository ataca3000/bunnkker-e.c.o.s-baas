<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_approvals')) {
            return;
        }

        Schema::create('marketing_campaign_approvals', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();
            $table->uuid('workflow_template_id')->nullable()->index();

            $table->unsignedSmallInteger('current_step_order')->default(1);
            $table->string('status', 30)->default('pending');

            $table->string('submitted_by', 36)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->timestamps();
        });

        Schema::create('marketing_campaign_approval_decisions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_approval_id')->index();
            $table->uuid('workflow_step_id')->nullable()->index();

            $table->unsignedSmallInteger('step_order');
            $table->string('step_name', 255)->nullable();
            $table->string('decision', 30);
            $table->string('decided_by', 36)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('decided_at')->useCurrent();

            // Immutable: no updated_at
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_approval_decisions');
        Schema::dropIfExists('marketing_campaign_approvals');
    }
};
