<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_bulk_jobs')) {
            return;
        }

        Schema::create('marketing_campaign_bulk_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('company_id', 36)->nullable()->index();

            $table->string('operation_type', 50);
            $table->json('campaign_draft_ids');
            $table->json('operation_payload')->nullable();

            $table->string('status', 30)->default('queued');
            $table->unsignedInteger('total_count')->default(0);
            $table->unsignedInteger('success_count')->default(0);
            $table->unsignedInteger('failure_count')->default(0);

            $table->json('results')->nullable();
            $table->string('queued_by', 36)->nullable();

            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_bulk_jobs');
    }
};
