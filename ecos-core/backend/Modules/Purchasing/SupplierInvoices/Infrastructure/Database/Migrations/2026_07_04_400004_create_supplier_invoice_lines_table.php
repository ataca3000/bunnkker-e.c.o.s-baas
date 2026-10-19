<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('supplier_invoice_lines')) {
            return;
        }

        Schema::create('supplier_invoice_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('supplier_invoice_id')->constrained('supplier_invoices')->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();

            $table->string('description', 255)->nullable();
            $table->decimal('quantity', 18, 4);
            $table->decimal('unit_price', 18, 4);
            $table->decimal('tax_rate', 8, 4)->default(0);
            $table->decimal('tax_amount', 18, 4)->default(0);
            $table->decimal('discount_amount', 18, 4)->default(0);
            $table->decimal('line_total', 18, 4);

            // UOM snapshot
            $table->string('uom_id_snapshot', 36)->nullable();
            $table->string('uom_name_snapshot', 50)->nullable();
            $table->string('uom_symbol_snapshot', 20)->nullable();

            // Landed cost allocation
            $table->decimal('allocated_freight', 18, 4)->default(0);
            $table->decimal('allocated_additional_costs', 18, 4)->default(0);
            $table->decimal('landed_unit_cost', 18, 4)->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('supplier_invoice_id');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_invoice_lines');
    }
};
