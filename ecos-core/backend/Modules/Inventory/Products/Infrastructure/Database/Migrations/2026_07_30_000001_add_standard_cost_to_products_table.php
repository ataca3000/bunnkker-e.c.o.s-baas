<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * EPIC-DATA-CONSOLIDATION-001, Phase C — support the Standard cost strategy.
 *
 * Additive, nullable column. FIFO remains the canonical valuation basis; Standard
 * is an operator-set alternative resolved by EnterpriseCostEngine when selected.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'standard_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('standard_cost', 15, 4)->nullable()->after('current_fifo_cost');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('products', 'standard_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('standard_cost');
        });
    }
};
