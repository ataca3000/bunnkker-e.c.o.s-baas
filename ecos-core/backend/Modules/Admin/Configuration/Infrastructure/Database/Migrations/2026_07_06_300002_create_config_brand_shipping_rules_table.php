<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ASK-CONFIG-OS-001 â€” Brand-specific Shipping Pricing Rules.
 *
 * Governs shipping cost per delivery zone.
 * Brand-scoped (unlike the legacy company-scoped shipping_pricing_rules).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('config_brand_shipping_rules')) {
            return;
        }

        Schema::create('config_brand_shipping_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('brand_id')->constrained('brands')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignUuid('delivery_zone_id')
                ->nullable()
                ->constrained('config_delivery_zones')
                ->nullOnDelete();
            $table->foreignUuid('delivery_geography_id')
                ->nullable()
                ->constrained('config_delivery_geographies')
                ->nullOnDelete();
            $table->decimal('shipping_cost', 10, 2)->default(0);
            $table->boolean('is_enabled')->default(true);
            $table->date('effective_date')->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->unique(['brand_id', 'delivery_zone_id'], 'uq_cbsr_brand_zone');
            $table->index(['brand_id', 'is_enabled'], 'idx_cbsr_brand_enabled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('config_brand_shipping_rules');
    }
};
