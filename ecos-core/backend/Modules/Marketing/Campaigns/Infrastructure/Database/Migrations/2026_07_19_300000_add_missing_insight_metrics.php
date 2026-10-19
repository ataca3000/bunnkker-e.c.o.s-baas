<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds metrics required by TASK-META-INTEGRATION-004:
 *  - unique_ctr, unique_clicks
 *  - purchase_value (revenue from conversions)
 *  - engagement (post engagement count)
 *  - cpa (cost per acquisition)
 *  - roas, roas_website (return on ad spend)
 *  - breakdowns JSON (reserved for future placement/device/age/gender/country)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('marketing_campaign_insights', 'unique_ctr')) {
            return;
        }

        Schema::table('marketing_campaign_insights', function (Blueprint $table): void {
            // Unique engagement metrics
            $table->decimal('unique_ctr', 14, 6)->nullable()->after('ctr');
            $table->unsignedBigInteger('unique_clicks')->nullable()->after('clicks');

            // Conversion value metrics
            $table->decimal('purchase_value', 14, 4)->nullable()->after('purchases');
            $table->unsignedBigInteger('engagement')->nullable()->after('conversions');

            // Efficiency — cost & return
            $table->decimal('cpa', 14, 4)->nullable()->after('cost_per_result');
            $table->decimal('roas', 14, 4)->nullable()->after('cpa');
            $table->decimal('roas_website', 14, 4)->nullable()->after('roas');

            // Future breakdown support (placement / device / age / gender / country / region / platform)
            $table->json('breakdowns')->nullable()->after('actions');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('marketing_campaign_insights', 'unique_ctr')) {
            return;
        }

        Schema::table('marketing_campaign_insights', function (Blueprint $table): void {
            $table->dropColumn([
                'unique_ctr', 'unique_clicks',
                'purchase_value', 'engagement',
                'cpa', 'roas', 'roas_website',
                'breakdowns',
            ]);
        });
    }
};
