<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campaigns — Provider Identity.
 *
 * Stores the synchronized view of campaigns from any marketing connector.
 * The `provider_payload` column is IMMUTABLE — never overwrite.
 * Business context lives in marketing_campaign_business_contexts.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaigns')) {
            return;
        }

        Schema::create('marketing_campaigns', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Source connection
            $table->uuid('marketing_connection_id')->nullable()->index('mkt_camp_conn_idx');
            $table->string('company_id', 36)->nullable()->index('mkt_camp_company_idx');
            $table->string('connector_type', 30)->index('mkt_camp_connector_idx');

            // Provider identity
            $table->string('external_campaign_id', 255);
            $table->string('external_account_id', 255)->nullable();    // Ad Account ID from provider
            $table->string('name', 500);
            $table->string('status', 30)->default('PAUSED')->index('mkt_camp_status_idx');

            // Campaign configuration
            $table->string('objective', 100)->nullable();
            $table->string('buying_type', 50)->nullable();             // AUCTION, FIXED_CPM, RESERVED
            $table->string('bid_strategy', 100)->nullable();

            // Budgets (in account currency cents / provider unit)
            $table->decimal('daily_budget', 14, 2)->nullable();
            $table->decimal('lifetime_budget', 14, 2)->nullable();
            $table->decimal('budget_remaining', 14, 2)->nullable();

            // Schedule
            $table->timestamp('start_time')->nullable();
            $table->timestamp('stop_time')->nullable();

            // Provider timestamps (from the platform, not ECOS)
            $table->timestamp('provider_created_at')->nullable();
            $table->timestamp('provider_updated_at')->nullable();

            // Sync tracking
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamp('next_sync_at')->nullable();
            $table->string('health_status', 30)->nullable()->default('unknown');

            // Immutable raw provider response
            $table->json('provider_payload')->nullable();

            $table->timestamps();

            // Unique: one campaign record per connector + provider campaign ID
            $table->unique(['connector_type', 'external_campaign_id'], 'mkt_camp_conn_ext_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaigns');
    }
};
