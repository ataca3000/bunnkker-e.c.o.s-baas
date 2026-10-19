<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_draft_creatives')) {
            return;
        }

        Schema::create('marketing_campaign_draft_creatives', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();

            $table->string('creative_type', 30)->default('image');
            $table->string('name', 500)->nullable();

            // Copy
            $table->string('headline', 500)->nullable();
            $table->text('primary_text')->nullable();
            $table->text('description')->nullable();
            $table->string('call_to_action', 100)->nullable();

            // Destination & Tracking
            $table->text('destination_url')->nullable();
            $table->json('utm_params')->nullable();

            // Media (image/video/carousel items)
            $table->json('media_items')->nullable();
            $table->json('asset_ids')->nullable();

            // Status
            $table->string('status', 30)->default('draft');
            $table->unsignedSmallInteger('sort_order')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_draft_creatives');
    }
};
