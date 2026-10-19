<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('city', 100)->nullable()->after('governorate');
            $table->string('shipping_address', 500)->nullable()->after('city');
            $table->string('building', 100)->nullable()->after('shipping_address');
            $table->string('floor', 50)->nullable()->after('building');
            $table->string('apartment', 50)->nullable()->after('floor');
            $table->string('landmark', 200)->nullable()->after('apartment');
            $table->string('address_notes', 500)->nullable()->after('landmark');
            $table->string('google_maps_url', 2000)->nullable()->after('google_maps_lng');
            $table->string('location_source', 50)->nullable()->after('google_maps_url');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn([
                'city', 'shipping_address', 'building', 'floor',
                'apartment', 'landmark', 'address_notes',
                'google_maps_url', 'location_source',
            ]);
        });
    }
};
