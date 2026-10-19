<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * EPIC-LOG-V2-001 — D1 (CTO approved).
 *
 * Route optimisation needs points. This is the single approved additive
 * extension to a Logistics V1 table: two nullable columns on the geography
 * master, so Routing can read coordinates instead of V2 duplicating the
 * geography it is not allowed to own.
 *
 * Additive only — no existing column, index or behaviour changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('logistics_cities')) {
            return;
        }

        Schema::table('logistics_cities', function (Blueprint $table): void {
            if (! Schema::hasColumn('logistics_cities', 'latitude')) {
                $table->decimal('latitude', 10, 7)->nullable()->after('name_en');
            }

            if (! Schema::hasColumn('logistics_cities', 'longitude')) {
                $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('logistics_cities')) {
            return;
        }

        Schema::table('logistics_cities', function (Blueprint $table): void {
            if (Schema::hasColumn('logistics_cities', 'longitude')) {
                $table->dropColumn('longitude');
            }

            if (Schema::hasColumn('logistics_cities', 'latitude')) {
                $table->dropColumn('latitude');
            }
        });
    }
};
