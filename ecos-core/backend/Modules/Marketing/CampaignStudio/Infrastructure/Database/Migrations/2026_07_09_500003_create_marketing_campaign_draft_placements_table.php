<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_draft_placements')) {
            return;
        }

        Schema::create('marketing_campaign_draft_placements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->unique();

            $table->string('placement_mode', 20)->default('auto');

            // Individual placement toggles (manual mode)
            $table->boolean('facebook_feed')->default(true);
            $table->boolean('instagram_feed')->default(true);
            $table->boolean('facebook_stories')->default(false);
            $table->boolean('instagram_stories')->default(false);
            $table->boolean('facebook_reels')->default(false);
            $table->boolean('instagram_reels')->default(false);
            $table->boolean('messenger_inbox')->default(false);
            $table->boolean('audience_network')->default(false);

            // Explicit exclusions (for auto mode)
            $table->json('excluded_placements')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_draft_placements');
    }
};
