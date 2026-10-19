<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_ads')) {
            return;
        }

        Schema::create('marketing_campaign_ads', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('marketing_campaign_id')->index('mkt_ad_camp_idx');
            $table->uuid('marketing_campaign_ad_set_id')->index('mkt_ad_adset_idx');
            $table->uuid('marketing_connection_id');

            $table->string('external_ad_id', 255)->unique('mkt_ad_ext_unique');
            $table->string('external_ad_set_id', 255)->index('mkt_ad_ext_adset_idx');
            $table->string('external_campaign_id', 255)->index('mkt_ad_ext_camp_idx');

            $table->string('name', 500);
            $table->string('status', 30)->default('PAUSED')->index('mkt_ad_status_idx');

            $table->string('creative_id', 255)->nullable();
            $table->json('tracking_specs')->nullable();

            $table->timestamp('provider_created_at')->nullable();
            $table->timestamp('provider_updated_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();

            $table->json('provider_payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_ads');
    }
};
