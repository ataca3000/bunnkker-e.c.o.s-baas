<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'google_maps_lat')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('google_maps_lat', 10, 7)->nullable()->after('remaining_balance');
            $table->decimal('google_maps_lng', 10, 7)->nullable()->after('google_maps_lat');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'google_maps_lat')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['google_maps_lat', 'google_maps_lng']);
        });
    }
};
