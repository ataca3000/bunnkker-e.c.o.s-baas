<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ASK-CONFIG-OS-001 â€” Delivery Geography: Governorates per Brand.
 *
 * A brand defines which governorates it delivers to. Each governorate
 * is the parent for one or more delivery zones.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('config_delivery_geographies')) {
            return;
        }

        Schema::create('config_delivery_geographies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('brand_id')->constrained('brands')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('name_ar', 150)->nullable();
            $table->string('code', 50)->nullable()->comment('ISO or custom governorate code');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->unique(['brand_id', 'name'], 'uq_cdg_brand_name');
            $table->index(['brand_id', 'is_active'], 'idx_cdg_brand_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('config_delivery_geographies');
    }
};
