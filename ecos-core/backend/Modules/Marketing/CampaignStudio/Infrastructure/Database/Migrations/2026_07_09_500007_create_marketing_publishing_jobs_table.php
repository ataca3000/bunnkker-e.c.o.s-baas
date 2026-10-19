<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_publishing_jobs')) {
            return;
        }

        Schema::create('marketing_publishing_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();

            $table->string('operation', 30);
            $table->string('status', 30)->default('queued');
            $table->string('connector_type', 30)->nullable();
            $table->uuid('connection_id')->nullable()->index();

            // What to send to the connector
            $table->json('payload')->nullable();

            // What came back from the connector
            $table->json('result')->nullable();
            $table->text('error_message')->nullable();
            $table->json('error_context')->nullable();

            // Retry tracking
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->unsignedSmallInteger('max_attempts')->default(3);
            $table->timestamp('next_retry_at')->nullable();

            // Scheduling
            $table->timestamp('scheduled_at')->nullable();
            $table->string('scheduled_timezone', 100)->nullable();

            // Lifecycle
            $table->string('queued_by', 36)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();
        });

        Schema::table('marketing_publishing_jobs', function (Blueprint $table): void {
            $table->index(['status', 'scheduled_at'], 'mkt_pj_status_scheduled_idx');
            $table->index(['campaign_draft_id', 'status'], 'mkt_pj_draft_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_publishing_jobs');
    }
};
