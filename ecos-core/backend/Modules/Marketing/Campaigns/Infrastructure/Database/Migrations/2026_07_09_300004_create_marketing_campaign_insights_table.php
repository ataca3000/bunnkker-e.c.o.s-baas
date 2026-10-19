<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campaign Insights — Immutable Historical Snapshots.
 *
 * CRITICAL: Historical data MUST NEVER be overwritten.
 * Every sync creates NEW rows. Reads always query latest by synced_at.
 * There is intentionally NO updated_at column.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_insights')) {
            return;
        }

        Schema::create('marketing_campaign_insights', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Level identifiers
            $table->uuid('marketing_campaign_id')->index('mkt_ins_camp_idx');
            $table->uuid('marketing_campaign_ad_set_id')->nullable()->index('mkt_ins_adset_idx');
            $table->uuid('marketing_campaign_ad_id')->nullable()->index('mkt_ins_ad_idx');
            $table->uuid('marketing_connection_id')->index('mkt_ins_conn_idx');

            $table->string('connector_type', 30);
            $table->string('level', 20);                // 'campaign' | 'adset' | 'ad'
            $table->date('date_start');
            $table->date('date_stop');
            $table->string('date_preset', 50)->nullable();

            // Delivery metrics
            $table->decimal('spend', 14, 4)->nullable();
            $table->unsignedBigInteger('reach')->nullable();
            $table->unsignedBigInteger('impressions')->nullable();
            $table->decimal('frequency', 14, 6)->nullable();

            // Efficiency metrics
            $table->decimal('cpm', 14, 4)->nullable();
            $table->decimal('cpc', 14, 4)->nullable();
            $table->decimal('ctr', 14, 6)->nullable();

            // Traffic metrics
            $table->unsignedBigInteger('clicks')->nullable();
            $table->unsignedBigInteger('outbound_clicks')->nullable();
            $table->unsignedBigInteger('landing_page_views')->nullable();
            $table->unsignedBigInteger('video_views')->nullable();

            // Conversion metrics
            $table->unsignedBigInteger('messages')->nullable();
            $table->unsignedBigInteger('leads')->nullable();
            $table->unsignedBigInteger('purchases')->nullable();
            $table->unsignedBigInteger('add_to_cart')->nullable();
            $table->unsignedBigInteger('initiate_checkout')->nullable();
            $table->unsignedBigInteger('conversions')->nullable();
            $table->decimal('cost_per_result', 14, 4)->nullable();

            // Raw actions array from provider (immutable)
            $table->json('actions')->nullable();

            // Snapshot metadata
            $table->timestamp('synced_at')->useCurrent();

            // Only created_at — NO updated_at
            $table->timestamp('created_at')->useCurrent();

            // Query indexes
            $table->index(['marketing_campaign_id', 'level', 'date_start', 'date_stop'], 'mkt_ins_camp_level_date_idx');
            $table->index(['marketing_connection_id', 'synced_at'], 'mkt_ins_conn_synced_idx');
            $table->index(['level', 'date_start'], 'mkt_ins_level_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_insights');
    }
};
