<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_business_events')) {
            return;
        }

        Schema::create('bae_business_events', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('event_uuid')->unique();

            $table->string('event_name', 150);
            $table->string('category', 50);
            $table->string('producer_module', 100);
            $table->string('producer_entity', 100);

            // Polymorphic entity reference
            $table->uuid('entity_id')->nullable();
            $table->string('entity_type', 100)->nullable();

            // Business context
            $table->uuid('company_id')->nullable();
            $table->uuid('brand_id')->nullable();
            $table->uuid('channel_id')->nullable();
            $table->uuid('warehouse_id')->nullable();
            $table->string('business_unit', 100)->nullable();
            $table->string('cost_center', 100)->nullable();

            // Actor
            $table->uuid('actor_id')->nullable();
            $table->string('actor_type', 100)->nullable();

            $table->timestamp('occurred_at');
            $table->uuid('correlation_id')->nullable();
            $table->uuid('business_dna_id')->nullable();

            $table->json('payload');
            $table->json('metadata')->nullable();
            $table->string('version', 10)->default('1.0');

            // Append-only: no updated_at
            $table->timestamp('created_at')->useCurrent();

            $table->index(['category', 'occurred_at'], 'bae_ev_cat_at_idx');
            $table->index(['entity_type', 'entity_id'], 'bae_ev_entity_idx');
            $table->index(['company_id', 'occurred_at'], 'bae_ev_co_at_idx');
            $table->index('correlation_id', 'bae_ev_corr_idx');
            $table->index('business_dna_id', 'bae_ev_dna_idx');
            $table->index(['producer_module', 'occurred_at'], 'bae_ev_prod_at_idx');
            $table->index('occurred_at', 'bae_ev_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_business_events');
    }
};
