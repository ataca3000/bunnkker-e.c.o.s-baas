<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Replace the plain unique(['warehouse_id', 'product_id']) constraint with a
 * partial unique index that excludes soft-deleted rows. Without this change,
 * a soft-deleted InventoryItem occupies the slot and prevents a new item for
 * the same warehouse+product pair from being created via findOrCreate().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->dropUnique(['warehouse_id', 'product_id']);
        });

        // PostgreSQL supports partial unique indexes; MySQL does not.
        // On PostgreSQL (production), create a partial index that excludes soft-deleted rows
        // so a warehouse+product slot can be reused after soft-deletion.
        // On MySQL (test/dev), the plain unique is dropped; application-level SoftDeletes
        // filtering in findOrCreate() provides the active-row guard.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'CREATE UNIQUE INDEX inventory_items_warehouse_product_active_unique '
                .'ON inventory_items (warehouse_id, product_id) WHERE deleted_at IS NULL',
            );
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS inventory_items_warehouse_product_active_unique');
        }

        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->unique(['warehouse_id', 'product_id']);
        });
    }
};
