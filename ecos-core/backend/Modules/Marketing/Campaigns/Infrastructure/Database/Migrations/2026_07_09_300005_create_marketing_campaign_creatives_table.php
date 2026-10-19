<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Campaign Creatives — Creative Library.
 *
 * Stores Image, Video, Carousel, Collection creatives.
 * The `provider_payload` column is IMMUTABLE.
 * Prepared for future AI creative analysis.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_creatives')) {
            return;
        }

        Schema::create('marketing_campaign_creatives', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('marketing_connection_id')->index('mkt_cre_conn_idx');
            $table->uuid('marketing_campaign_id')->nullable()->index('mkt_cre_camp_idx');
            $table->uuid('marketing_campaign_ad_id')->nullable()->index('mkt_cre_ad_idx');

            $table->string('external_creative_id', 255)->unique('mkt_cre_ext_unique');
            $table->string('creative_type', 30)->default('other');

            // Creative content
            $table->string('name', 500)->nullable();
            $table->string('headline', 500)->nullable();
            $table->text('primary_text')->nullable();
            $table->text('description')->nullable();
            $table->string('call_to_action', 100)->nullable();

            // Media assets
            $table->text('image_url')->nullable();
            $table->text('video_url')->nullable();
            $table->text('thumbnail_url')->nullable();
            $table->text('body')->nullable();
            $table->text('link_url')->nullable();

            // Carousel/Collection data
            $table->json('asset_feed')->nullable();

            // Immutable raw provider response
            $table->json('provider_payload')->nullable();
            $table->timestamp('last_synced_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_creatives');
    }
};
