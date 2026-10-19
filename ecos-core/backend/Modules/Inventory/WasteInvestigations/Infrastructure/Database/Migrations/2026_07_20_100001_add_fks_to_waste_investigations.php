<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add referential integrity (foreign key constraints) to waste_investigations
 * and warehouse_liabilities. These tables were originally created with plain
 * uuid columns and indexes but no FK enforcement, allowing orphaned rows when
 * a parent is deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('waste_investigations', function (Blueprint $table): void {
            $table->foreign('company_id')->references('id')->on('companies')->restrictOnDelete();
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->restrictOnDelete();
            $table->foreign('count_session_id')->references('id')->on('inventory_count_sessions')->restrictOnDelete();
            $table->foreign('count_line_id')->references('id')->on('inventory_count_lines')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });

        Schema::table('warehouse_liabilities', function (Blueprint $table): void {
            $table->foreign('company_id')->references('id')->on('companies')->restrictOnDelete();
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->restrictOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
            $table->foreign('count_session_id')->references('id')->on('inventory_count_sessions')->restrictOnDelete();
            $table->foreign('count_line_id')->references('id')->on('inventory_count_lines')->restrictOnDelete();
            $table->foreign('waste_investigation_id')->references('id')->on('waste_investigations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('warehouse_liabilities', function (Blueprint $table): void {
            $table->dropForeign(['waste_investigation_id']);
            $table->dropForeign(['count_line_id']);
            $table->dropForeign(['count_session_id']);
            $table->dropForeign(['product_id']);
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['company_id']);
        });

        Schema::table('waste_investigations', function (Blueprint $table): void {
            $table->dropForeign(['product_id']);
            $table->dropForeign(['count_line_id']);
            $table->dropForeign(['count_session_id']);
            $table->dropForeign(['warehouse_id']);
            $table->dropForeign(['company_id']);
        });
    }
};
