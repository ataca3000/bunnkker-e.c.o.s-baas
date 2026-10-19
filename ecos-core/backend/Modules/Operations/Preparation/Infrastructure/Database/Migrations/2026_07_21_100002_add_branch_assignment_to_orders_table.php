<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Branch assignment columns on orders.
 *
 * Adds:
 *  - assigned_branch_id              : the branch responsible for this order's fulfillment
 *  - warehouse_assignment_failure_reason : operational signal when no branch covers the destination
 *
 * Also extends the warehouse_assignment_source CHECK constraint to include the two
 * new values produced by BranchAssignmentEngine:
 *  - branch_coverage    : warehouse assigned automatically via branch coverage
 *  - no_branch_coverage : no active branch covers the delivery destination
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'assigned_branch_id')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->uuid('assigned_branch_id')->nullable()->after('assigned_warehouse_id');
                $table->string('warehouse_assignment_failure_reason', 255)->nullable()->after('warehouse_assignment_source');
            });

            DB::statement('CREATE INDEX idx_orders_assigned_branch_id ON orders (assigned_branch_id)');
        }

        // Extend the CHECK constraint to recognise the two new source values.
        // Drop the old constraint (installed by 2026_07_06_210005) then recreate with full list.
        $this->dropCheckConstraintIfExists('orders', 'chk_orders_warehouse_assignment_source');

        DB::statement(
            'ALTER TABLE orders ADD CONSTRAINT chk_orders_warehouse_assignment_source '
            .'CHECK (warehouse_assignment_source IS NULL OR warehouse_assignment_source IN ('
            ."'auto_policy','manual_override','channel_default','unassigned',"
            ."'branch_coverage','no_branch_coverage'"
            .'))',
        );
    }

    public function down(): void
    {
        $this->dropCheckConstraintIfExists('orders', 'chk_orders_warehouse_assignment_source');

        DB::statement(
            'ALTER TABLE orders ADD CONSTRAINT chk_orders_warehouse_assignment_source '
            .'CHECK (warehouse_assignment_source IS NULL OR warehouse_assignment_source IN ('
            ."'auto_policy','manual_override','channel_default','unassigned'"
            .'))',
        );

        DB::statement('DROP INDEX IF EXISTS idx_orders_assigned_branch_id');

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['assigned_branch_id', 'warehouse_assignment_failure_reason']);
        });
    }

    /**
     * Drop a named CHECK constraint only when it exists (MySQL-compatible).
     * MySQL does not support DROP CHECK IF EXISTS — check information_schema first.
     */
    private function dropCheckConstraintIfExists(string $table, string $name): void
    {
        $exists = DB::selectOne(
            'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = ?
             AND CONSTRAINT_NAME = ?',
            [$table, $name],
        );

        if ($exists !== null) {
            DB::statement("ALTER TABLE {$table} DROP CHECK {$name}");
        }
    }
};
