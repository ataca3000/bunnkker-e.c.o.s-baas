<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_draft_audiences')) {
            return;
        }

        Schema::create('marketing_campaign_draft_audiences', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();

            // Geography targeting (provider-independent)
            $table->json('countries')->nullable();
            $table->json('governorates')->nullable();
            $table->json('cities')->nullable();
            $table->unsignedInteger('radius_km')->nullable();

            // Demographics
            $table->unsignedSmallInteger('age_min')->nullable()->default(18);
            $table->unsignedSmallInteger('age_max')->nullable()->default(65);
            $table->json('genders')->nullable();
            $table->json('languages')->nullable();

            // Behavioral targeting
            $table->json('interests')->nullable();
            $table->json('behaviors')->nullable();

            // Audience sources
            $table->json('lookalike_audiences')->nullable();
            $table->json('custom_audiences')->nullable();
            $table->json('saved_audiences')->nullable();
            $table->json('exclusions')->nullable();

            // Provider-formatted raw targeting (generated on publish)
            $table->json('raw_targeting')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_draft_audiences');
    }
};
