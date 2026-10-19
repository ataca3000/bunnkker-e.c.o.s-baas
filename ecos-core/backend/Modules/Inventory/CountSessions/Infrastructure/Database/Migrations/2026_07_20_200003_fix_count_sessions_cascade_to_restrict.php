<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M-05: Resolve the cascade-chain conflict in the accountability workflow.
 *
 * The conflict: inventory_count_sessions used CASCADE on warehouse_id and company_id,
 * but downstream tables (waste_investigations, warehouse_liabilities) use RESTRICT on
 * count_session_id. This created a deadlock where warehouse deletion would attempt to
 * cascade through count sessions, only to be blocked by RESTRICT on waste_investigations.
 *
 * Decision (ADR-ACCT-001): The entire accountability chain uses RESTRICT.
 * A warehouse (or company) cannot be deleted if it has count sessions.
 * A count session cannot be deleted if it has waste investigations or liabilities.
 * This policy matches the RESTRICT pattern already applied to all other audit tables
 * and prevents silent destruction of historical accountability records.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_count_sessions', function (Blueprint $table): void {
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['company_id']);

            $table->foreign('warehouse_id')
                ->references('id')->on('warehouses')->restrictOnDelete();

            $table->foreign('company_id')
                ->references('id')->on('companies')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_count_sessions', function (Blueprint $table): void {
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['company_id']);

            $table->foreign('warehouse_id')
                ->references('id')->on('warehouses')->cascadeOnDelete();

            $table->foreign('company_id')
                ->references('id')->on('companies')->cascadeOnDelete();
        });
    }
};
