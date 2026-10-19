<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_ad_sets')) {
            return;
        }

        Schema::create('marketing_campaign_ad_sets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('marketing_campaign_id')->index('mkt_adset_camp_idx');
            $table->uuid('marketing_connection_id')->index('mkt_adset_conn_idx');

            $table->string('external_ad_set_id', 255)->unique('mkt_adset_ext_unique');
            $table->string('external_campaign_id', 255)->index('mkt_adset_ext_camp_idx');

            $table->string('name', 500);
            $table->string('status', 30)->default('PAUSED')->index('mkt_adset_status_idx');

            // Budget
            $table->decimal('daily_budget', 14, 2)->nullable();
            $table->decimal('lifetime_budget', 14, 2)->nullable();
            $table->decimal('bid_amount', 14, 2)->nullable();
            $table->string('bid_strategy', 100)->nullable();

            // Delivery
            $table->string('optimization_goal', 100)->nullable();
            $table->string('billing_event', 50)->nullable();

            // Targeting snapshot (from provider)
            $table->json('targeting')->nullable();

            // Schedule
            $table->timestamp('start_time')->nullable();
            $table->timestamp('end_time')->nullable();

            $table->timestamp('provider_created_at')->nullable();
            $table->timestamp('provider_updated_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();

            $table->json('provider_payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_ad_sets');
    }
};
