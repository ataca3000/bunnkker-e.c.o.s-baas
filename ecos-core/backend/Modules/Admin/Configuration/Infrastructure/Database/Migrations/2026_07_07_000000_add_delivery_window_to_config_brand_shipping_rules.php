<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-CONFIG-OS-002 — Link a default delivery window to each shipping rule (zone level).
 *
 * Additive, nullable column. No breaking changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('config_brand_shipping_rules', 'delivery_window_id')) {
            return;
        }

        Schema::table('config_brand_shipping_rules', function (Blueprint $table): void {
            $table->foreignUuid('delivery_window_id')
                ->nullable()
                ->after('notes')
                ->constrained('config_delivery_windows')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('config_brand_shipping_rules', 'delivery_window_id')) {
            return;
        }

        Schema::table('config_brand_shipping_rules', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('delivery_window_id');
        });
    }
};
