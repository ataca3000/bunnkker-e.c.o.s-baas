<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_business_dna')) {
            return;
        }

        Schema::create('bae_business_dna', static function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Owning entity (polymorphic)
            $table->string('entity_type', 50);
            $table->uuid('entity_id');

            // Origin attribution
            $table->string('origin_provider', 50)->nullable();
            $table->string('origin_platform', 100)->nullable();
            $table->uuid('provider_connector_id')->nullable();

            // Marketing attribution IDs (no FK — BAE is independent of Marketing)
            $table->uuid('initiative_id')->nullable();
            $table->uuid('campaign_id')->nullable();
            $table->uuid('ad_set_id')->nullable();
            $table->uuid('ad_id')->nullable();
            $table->uuid('creative_id')->nullable();
            $table->string('landing_page', 500)->nullable();
            $table->string('conversation_source', 100)->nullable();
            $table->string('lead_source', 100)->nullable();

            // Human attribution
            $table->uuid('sales_rep_id')->nullable();
            $table->string('marketing_team', 100)->nullable();

            // Business context
            $table->uuid('company_id')->nullable();
            $table->uuid('brand_id')->nullable();
            $table->uuid('channel_id')->nullable();
            $table->uuid('warehouse_id')->nullable();
            $table->string('cost_center', 100)->nullable();
            $table->string('business_unit', 100)->nullable();

            // Touch attribution (JSON: {event_id, occurred_at, source, campaign_id, ...})
            $table->json('first_touch')->nullable();
            $table->json('last_touch')->nullable();

            // Lifecycle timestamps
            $table->timestamp('acquisition_timestamp')->nullable();
            $table->timestamp('conversion_timestamp')->nullable();
            $table->timestamp('repeat_purchase_timestamp')->nullable();
            $table->string('customer_lifetime_stage', 50)->nullable();

            // Attribution
            $table->uuid('internal_attribution_id')->nullable();
            $table->string('attribution_model', 50)->nullable();

            // Raw metadata
            $table->json('provider_metadata')->nullable();
            $table->json('erp_metadata')->nullable();

            $table->timestamps();

            $table->unique(['entity_type', 'entity_id'], 'bae_dna_entity_uq');
            $table->index(['company_id', 'entity_type'], 'bae_dna_co_type_idx');
            $table->index('campaign_id', 'bae_dna_camp_idx');
            $table->index('initiative_id', 'bae_dna_init_idx');
            $table->index('customer_lifetime_stage', 'bae_dna_stage_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_business_dna');
    }
};
