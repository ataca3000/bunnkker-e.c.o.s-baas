<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campaign Business Context — ECOS Identity.
 *
 * These fields belong ONLY to ECOS and are NEVER overwritten by provider sync.
 * One-to-one with marketing_campaigns.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_business_contexts')) {
            return;
        }

        Schema::create('marketing_campaign_business_contexts', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // One-to-one relationship with campaign
            $table->uuid('marketing_campaign_id')->unique('mkt_ctx_camp_unique');

            // ECOS entity references (soft references, no FK constraints)
            $table->string('company_id', 36)->nullable()->index('mkt_ctx_company_idx');
            $table->string('brand_id', 36)->nullable()->index('mkt_ctx_brand_idx');
            $table->string('channel_id', 36)->nullable()->index('mkt_ctx_channel_idx');

            // Organizational context
            $table->string('cost_center', 255)->nullable();
            $table->string('marketing_team', 255)->nullable();
            $table->string('marketing_owner_id', 36)->nullable()->index('mkt_ctx_owner_idx');
            $table->string('business_unit', 255)->nullable();

            // Campaign context
            $table->string('season', 50)->nullable();          // Season enum value
            $table->string('custom_season', 255)->nullable();  // when season='custom'
            $table->string('business_goal', 50)->nullable()->index('mkt_ctx_goal_idx');

            // Internal classification
            $table->string('internal_status', 50)->nullable();
            $table->string('internal_priority', 20)->nullable();    // low, medium, high, critical
            $table->text('internal_notes')->nullable();
            $table->json('internal_tags')->nullable();

            // Actor tracking
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_business_contexts');
    }
};
