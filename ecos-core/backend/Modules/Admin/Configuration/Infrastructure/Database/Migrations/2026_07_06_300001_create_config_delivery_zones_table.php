<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ASK-CONFIG-OS-001 â€” Delivery Zones within a Governorate.
 *
 * Simple zone names only. No streets, no polygons, no GIS.
 * Example: Cairo â†’ Nasr City, Maadi, Heliopolis, New Cairo
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('config_delivery_zones')) {
            return;
        }

        Schema::create('config_delivery_zones', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('delivery_geography_id')
                ->constrained('config_delivery_geographies')
                ->cascadeOnDelete();
            $table->foreignUuid('brand_id')->constrained('brands')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('name_ar', 150)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->unique(['delivery_geography_id', 'name'], 'uq_cdz_geo_name');
            $table->index(['brand_id', 'is_active'], 'idx_cdz_brand_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('config_delivery_zones');
    }
};
