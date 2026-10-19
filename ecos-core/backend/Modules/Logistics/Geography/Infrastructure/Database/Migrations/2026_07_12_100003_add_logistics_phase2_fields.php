<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Logistics Phase 2 fields — prepared but not surfaced in business logic yet.
 * Governorates: estimated_delivery_days, same_day_supported
 * Cities: supports_cod, is_remote_area
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('logistics_governorates', 'estimated_delivery_days')) {
            return;
        }

        Schema::table('logistics_governorates', function (Blueprint $table): void {
            $table->unsignedTinyInteger('estimated_delivery_days')->nullable()->after('default_shipping_price');
            $table->boolean('same_day_supported')->default(false)->after('estimated_delivery_days');
        });

        Schema::table('logistics_cities', function (Blueprint $table): void {
            $table->boolean('supports_cod')->default(true)->after('shipping_price');
            $table->boolean('is_remote_area')->default(false)->after('supports_cod');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('logistics_governorates', 'estimated_delivery_days')) {
            return;
        }

        Schema::table('logistics_governorates', function (Blueprint $table): void {
            $table->dropColumn(['estimated_delivery_days', 'same_day_supported']);
        });

        Schema::table('logistics_cities', function (Blueprint $table): void {
            $table->dropColumn(['supports_cod', 'is_remote_area']);
        });
    }
};
