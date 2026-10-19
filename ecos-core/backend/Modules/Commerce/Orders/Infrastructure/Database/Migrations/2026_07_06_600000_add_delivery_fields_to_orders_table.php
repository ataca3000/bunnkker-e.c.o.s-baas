<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'delivery_window')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            // Delivery window label — e.g. "12:00 PM – 03:00 PM" from config_delivery_windows
            $table->string('delivery_window', 100)->nullable()->after('preferred_delivery_time');
            $table->uuid('delivery_window_id')->nullable()->after('delivery_window');

            // Delivery zone FK → config_delivery_zones (Admin Configuration OS)
            $table->uuid('delivery_zone_id')->nullable()->after('delivery_window_id');
            $table->string('delivery_zone', 150)->nullable()->after('delivery_zone_id');

            // Company stored directly on orders for reporting / multi-company support
            $table->uuid('company_id')->nullable()->after('channel_id');

            $table->index('delivery_zone_id');
            $table->index('delivery_window_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'delivery_window')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['delivery_zone_id']);
            $table->dropIndex(['delivery_window_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn([
                'delivery_window',
                'delivery_window_id',
                'delivery_zone_id',
                'delivery_zone',
                'company_id',
            ]);
        });
    }
};
