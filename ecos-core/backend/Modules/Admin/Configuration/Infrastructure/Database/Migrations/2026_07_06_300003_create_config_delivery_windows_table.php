<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ASK-CONFIG-OS-001 — Brand Delivery Windows.
 *
 * Defines available delivery time slots per brand.
 * Consumed by Orders, Preparation, Logistics, and Driver App.
 *
 * Defaults: 12–3 PM, 3–6 PM, 6–9 PM, 9 PM–12 AM
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('config_delivery_windows')) {
            return;
        }

        Schema::create('config_delivery_windows', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('brand_id')->constrained('brands')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->string('label', 100);
            $table->time('starts_at');
            $table->time('ends_at');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_enabled')->default(true);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->index(['brand_id', 'is_enabled'], 'idx_cdw_brand_enabled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('config_delivery_windows');
    }
};
