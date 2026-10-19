<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('customer_addresses', 'google_maps_url')) {
            return;
        }

        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->string('google_maps_url', 500)->nullable()->after('google_maps_lng');
            $table->string('location_source', 50)->nullable()->after('google_maps_url');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('customer_addresses', 'google_maps_url')) {
            return;
        }

        Schema::table('customer_addresses', function (Blueprint $table): void {
            $table->dropColumn(['google_maps_url', 'location_source']);
        });
    }
};
