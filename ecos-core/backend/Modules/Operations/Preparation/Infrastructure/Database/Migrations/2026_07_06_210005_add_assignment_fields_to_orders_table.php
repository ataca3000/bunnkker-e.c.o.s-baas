<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * CR-PREP-001 — Warehouse assignment tracking on orders.
 *
 * Extends the orders table with:
 *  - warehouse_assigned_at: when the assignment was made
 *  - warehouse_assignment_source: how the assignment was made
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'warehouse_assigned_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->timestampTz('warehouse_assigned_at')->nullable()->after('assigned_warehouse_id');
            $table->string('warehouse_assignment_source', 50)->nullable()->after('warehouse_assigned_at');
        });

        DB::statement(
            'ALTER TABLE orders ADD CONSTRAINT chk_orders_warehouse_assignment_source '
            .'CHECK (warehouse_assignment_source IS NULL OR warehouse_assignment_source IN ('
            ."'auto_policy','manual_override','channel_default','unassigned'"
            .'))',
        );

        DB::statement('CREATE INDEX idx_orders_warehouse_assignment_source ON orders (warehouse_assignment_source)');
        DB::statement('CREATE INDEX idx_orders_warehouse_assigned_at ON orders (warehouse_assigned_at)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_warehouse_assignment_source');
        DB::statement('DROP INDEX IF EXISTS idx_orders_warehouse_assignment_source');
        DB::statement('DROP INDEX IF EXISTS idx_orders_warehouse_assigned_at');

        if (Schema::hasColumn('orders', 'warehouse_assigned_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['warehouse_assigned_at', 'warehouse_assignment_source']);
        });
    }
};
