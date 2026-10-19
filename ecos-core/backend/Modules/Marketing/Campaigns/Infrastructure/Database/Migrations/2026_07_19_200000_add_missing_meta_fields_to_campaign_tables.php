<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds fields required by TASK-META-INTEGRATION-003:
 *  - effective_status on campaigns, ad_sets, ads
 *  - special_ad_categories (JSON) on campaigns
 *  - schedule (JSON) on ad_sets
 *  - preview_url on ads
 *  - image_hash + video_id on creatives
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('marketing_campaigns', 'effective_status')) {
            return;
        }

        Schema::table('marketing_campaigns', function (Blueprint $table): void {
            $table->string('effective_status', 30)->nullable()->after('status');
            $table->json('special_ad_categories')->nullable()->after('effective_status');
        });

        Schema::table('marketing_campaign_ad_sets', function (Blueprint $table): void {
            $table->string('effective_status', 30)->nullable()->after('status');
            $table->json('schedule')->nullable()->after('targeting');
        });

        Schema::table('marketing_campaign_ads', function (Blueprint $table): void {
            $table->string('effective_status', 30)->nullable()->after('status');
            $table->text('preview_url')->nullable()->after('tracking_specs');
        });

        Schema::table('marketing_campaign_creatives', function (Blueprint $table): void {
            $table->string('image_hash', 255)->nullable()->after('image_url');
            $table->string('video_id', 255)->nullable()->after('video_url');
        });
    }

    public function down(): void
    {
        Schema::table('marketing_campaigns', function (Blueprint $table): void {
            $table->dropColumn(['effective_status', 'special_ad_categories']);
        });

        Schema::table('marketing_campaign_ad_sets', function (Blueprint $table): void {
            $table->dropColumn(['effective_status', 'schedule']);
        });

        Schema::table('marketing_campaign_ads', function (Blueprint $table): void {
            $table->dropColumn(['effective_status', 'preview_url']);
        });

        Schema::table('marketing_campaign_creatives', function (Blueprint $table): void {
            $table->dropColumn(['image_hash', 'video_id']);
        });
    }
};
