<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_schedule_tasks')) {
            return;
        }

        Schema::create('marketing_campaign_schedule_tasks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();

            $table->string('task_type', 30);
            $table->timestamp('scheduled_for');
            $table->string('timezone', 100)->default('Africa/Cairo');

            $table->string('status', 30)->default('pending');
            $table->string('publishing_job_id', 36)->nullable()->index();

            $table->text('notes')->nullable();
            $table->string('created_by', 36)->nullable();
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'scheduled_for'], 'mkt_cst_status_scheduled_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_schedule_tasks');
    }
};
