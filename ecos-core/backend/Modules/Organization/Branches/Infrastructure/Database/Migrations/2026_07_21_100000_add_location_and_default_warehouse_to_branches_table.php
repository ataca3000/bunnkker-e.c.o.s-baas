<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Branch geo-coordinates + default warehouse link.
 *
 * Adds:
 *  - default_warehouse_id : the warehouse this branch fulfils orders from
 *  - latitude / longitude : used for nearest-branch selection when multiple branches cover an area
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('branches', 'default_warehouse_id')) {
            return;
        }

        Schema::table('branches', function (Blueprint $table): void {
            $table->uuid('default_warehouse_id')->nullable()->after('is_active');
            $table->decimal('latitude', 10, 7)->nullable()->after('default_warehouse_id');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table): void {
            $table->dropColumn(['default_warehouse_id', 'latitude', 'longitude']);
        });
    }
};
