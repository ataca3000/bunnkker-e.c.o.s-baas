<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Prevents duplicate active pricing rules for the same company + location.
 *
 * NULL city/area values are normalised to '' so that:
 *   (company, Cairo, NULL, NULL) is treated as the same combination as
 *   (company, Cairo, '', '') and a UNIQUE constraint can enforce it.
 *
 * PostgreSQL: functional unique index on COALESCE(col, '').
 * MySQL: generated (virtual/stored) columns city_key + area_key + unique index.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement("
                CREATE UNIQUE INDEX spr_company_geo_unique
                ON shipping_pricing_rules
                (company_id, governorate, COALESCE(city, ''), COALESCE(area, ''))
            ");
        } else {
            // MySQL 5.7+ supports generated columns.
            // Add stored virtual cols so the unique index can handle NULLs.
            $cols = collect(DB::select('SHOW COLUMNS FROM shipping_pricing_rules'))
                ->pluck('Field')
                ->all();

            if (! in_array('city_key', $cols, true)) {
                DB::statement(
                    "ALTER TABLE shipping_pricing_rules
                     ADD COLUMN city_key VARCHAR(100) GENERATED ALWAYS AS (COALESCE(city, '')) STORED",
                );
            }
            if (! in_array('area_key', $cols, true)) {
                DB::statement(
                    "ALTER TABLE shipping_pricing_rules
                     ADD COLUMN area_key VARCHAR(100) GENERATED ALWAYS AS (COALESCE(area, '')) STORED",
                );
            }

            $existing = collect(DB::select('SHOW INDEX FROM shipping_pricing_rules'))
                ->pluck('Key_name')
                ->unique()
                ->all();

            if (! in_array('spr_company_geo_unique', $existing, true)) {
                DB::statement(
                    'ALTER TABLE shipping_pricing_rules
                     ADD UNIQUE KEY spr_company_geo_unique
                     (company_id, governorate, city_key, area_key)',
                );
            }
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS spr_company_geo_unique');
        } else {
            $existing = collect(DB::select('SHOW INDEX FROM shipping_pricing_rules'))
                ->pluck('Key_name')
                ->unique()
                ->all();

            if (in_array('spr_company_geo_unique', $existing, true)) {
                Schema::table('shipping_pricing_rules', function ($table): void {
                    $table->dropIndex('spr_company_geo_unique');
                });
            }

            $cols = collect(DB::select('SHOW COLUMNS FROM shipping_pricing_rules'))
                ->pluck('Field')
                ->all();

            if (in_array('area_key', $cols, true)) {
                DB::statement('ALTER TABLE shipping_pricing_rules DROP COLUMN area_key');
            }
            if (in_array('city_key', $cols, true)) {
                DB::statement('ALTER TABLE shipping_pricing_rules DROP COLUMN city_key');
            }
        }
    }
};
