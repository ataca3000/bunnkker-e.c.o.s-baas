<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('logistics_cities', 'distribution_zone_id')) {
            return;
        }

        Schema::table('logistics_cities', function (Blueprint $table): void {
            $table->foreignId('distribution_zone_id')
                ->nullable()
                ->after('is_system')
                ->constrained('distribution_zones')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('logistics_cities', 'distribution_zone_id')) {
            return;
        }

        Schema::table('logistics_cities', function (Blueprint $table): void {
            $table->dropForeign(['distribution_zone_id']);
            $table->dropColumn('distribution_zone_id');
        });
    }
};
