<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('supplier_return_lines');
        if (Schema::hasTable('supplier_return_lines')) {
            return;
        }

        Schema::create('supplier_return_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('supplier_return_id')->constrained('supplier_returns')->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('goods_receipt_line_id')->nullable()->constrained('goods_receipt_lines')->nullOnDelete();

            $table->decimal('return_quantity', 18, 4);
            $table->decimal('unit_cost', 18, 4);
            $table->decimal('total_cost', 18, 4);

            $table->string('reason', 50)->nullable();
            $table->string('quality_condition', 30)->nullable();
            $table->text('notes')->nullable();

            // Snapshots from original receipt
            $table->string('uom_name_snapshot', 50)->nullable();
            $table->string('uom_symbol_snapshot', 20)->nullable();
            $table->decimal('original_received_qty', 18, 4)->nullable();
            $table->decimal('original_unit_cost', 18, 4)->nullable();

            $table->timestamps();

            $table->index('supplier_return_id');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_return_lines');
    }
};
