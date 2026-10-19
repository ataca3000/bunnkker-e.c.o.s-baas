<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'cost_source')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            // MFG-M001: cost_source — determines which mechanism updates current_cost.
            // 'purchase' = updated by GR posting only (default for all existing products).
            // 'recipe'   = updated by recipe recalculation only.
            // 'hybrid'   = accepts updates from both sources; most recent write wins.
            $table->string('cost_source', 20)->default('purchase')->after('current_fifo_cost');

            // Whether the product can be produced via a manufacturing recipe.
            $table->boolean('can_manufacture')->default(false)->after('cost_source');

            // Whether the product can be disassembled back into its recipe components.
            $table->boolean('can_disassemble')->default(false)->after('can_manufacture');

            // Evaluated on raw materials at consumption time (RC-2).
            // Finished goods are never produced into negative inventory.
            $table->boolean('allow_negative_stock')->default(false)->after('can_disassemble');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn([
                'cost_source',
                'can_manufacture',
                'can_disassemble',
                'allow_negative_stock',
            ]);
        });
    }
};
