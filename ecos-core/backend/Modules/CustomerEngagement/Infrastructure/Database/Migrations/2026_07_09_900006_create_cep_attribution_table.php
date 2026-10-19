<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_attribution')) {
            return;
        }

        Schema::create('cep_attribution', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('conversation_id')->index();

            $table->string('source_provider')->nullable();   // meta | google | organic

            // Meta-specific attribution (from CTWA click-to-whatsapp or Messenger ads)
            $table->string('ad_id')->nullable();
            $table->string('ad_set_id')->nullable();
            $table->string('campaign_id_external')->nullable();  // Meta campaign ID
            $table->string('creative_id')->nullable();
            $table->string('click_id')->nullable();              // fbclid / gclid

            // ECOS business objects (internal IDs)
            $table->uuid('ecos_campaign_id')->nullable();
            $table->uuid('ecos_initiative_id')->nullable();
            $table->uuid('business_dna_id')->nullable();

            // UTM
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();
            $table->string('utm_term')->nullable();
            $table->string('utm_content')->nullable();

            $table->string('landing_page')->nullable();
            $table->string('referrer')->nullable();

            $table->json('raw_payload')->nullable();   // raw attribution data from provider
            $table->timestamp('captured_at')->useCurrent();
            // immutable — no updated_at
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_attribution');
    }
};
