<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ARCH-PRICE-001: Add official cost fields to products table.
 *
 * material_cost  — official Material Cost (Part 2). Single source of truth for materials.
 *                  Updated by: manual edit OR approved purchase invoice (whichever is last).
 * product_cost   — computed Product Cost for manufactured products (Part 3).
 *                  = sum(component.material_cost × line.quantity) via active recipe.
 * unit_cost      — Product Cost ÷ yield_quantity (Part 1 dictionary).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'material_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('material_cost', 15, 4)->nullable()->after('current_fifo_cost');
            $table->decimal('product_cost', 15, 4)->nullable()->after('material_cost');
            $table->decimal('unit_cost', 15, 4)->nullable()->after('product_cost');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'material_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['material_cost', 'product_cost', 'unit_cost']);
        });
    }
};
