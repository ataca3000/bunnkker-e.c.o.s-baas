<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'logistics_city_id')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->unsignedBigInteger('logistics_city_id')->nullable()->after('city');
            });
        }

        // Add FK only if not already present
        $hasFk = collect(DB::select("
            SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = 'orders'
              AND COLUMN_NAME = 'logistics_city_id'
              AND CONSTRAINT_NAME != 'PRIMARY'
              AND REFERENCED_TABLE_NAME IS NOT NULL
        "))->isNotEmpty();

        if (! $hasFk) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->foreign('logistics_city_id')
                    ->references('id')
                    ->on('logistics_cities')
                    ->nullOnDelete();
            });
        }

        // Backfill: match orders.city (case-insensitive) to logistics_cities.name_en
        DB::statement('
            UPDATE orders o
            SET logistics_city_id = (
                SELECT lc.id
                FROM logistics_cities lc
                WHERE LOWER(lc.name_en) = LOWER(o.city)
                LIMIT 1
            )
            WHERE o.city IS NOT NULL
              AND o.logistics_city_id IS NULL
        ');
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropForeign(['logistics_city_id']);
            $table->dropColumn('logistics_city_id');
        });
    }
};
