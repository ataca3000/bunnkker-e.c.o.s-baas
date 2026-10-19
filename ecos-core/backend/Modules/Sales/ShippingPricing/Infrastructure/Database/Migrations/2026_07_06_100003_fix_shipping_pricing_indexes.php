<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The initial migration failed mid-way on MySQL because the compound
        // 4-column index exceeded the 3072-byte limit with varchar(255) columns.
        // This migration adds the two missing indexes using prefix lengths.

        $existing = collect(DB::select('SHOW INDEX FROM shipping_pricing_rules'))
            ->pluck('Key_name')
            ->unique()
            ->toArray();

        $idx4 = 'shipping_pricing_rules_company_id_governorate_city_area_index';
        if (! in_array($idx4, $existing, true)) {
            DB::statement(
                'ALTER TABLE shipping_pricing_rules ADD INDEX '.$idx4.
                ' (company_id, governorate(100), city(100), area(100))',
            );
        }

        $idxActive = 'shipping_pricing_rules_is_active_index';
        if (! in_array($idxActive, $existing, true)) {
            DB::statement(
                'ALTER TABLE shipping_pricing_rules ADD INDEX '.$idxActive.' (is_active)',
            );
        }
    }

    public function down(): void
    {
        Schema::table('shipping_pricing_rules', function ($table): void {
            $table->dropIndex('shipping_pricing_rules_company_id_governorate_city_area_index');
            $table->dropIndex('shipping_pricing_rules_is_active_index');
        });
    }
};
