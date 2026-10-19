<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Per-product return detail with warehouse reconciliation. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_return_lines')) {
            return;
        }

        Schema::create('delivery_return_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('return_id')->constrained('delivery_returns')->cascadeOnDelete();

            $table->uuid('product_id')->nullable();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->string('product_name', 255)->nullable();

            $table->decimal('ordered_qty', 12, 3)->default(0);
            $table->decimal('delivered_qty', 12, 3)->default(0);
            $table->decimal('returned_qty', 12, 3)->default(0);
            $table->decimal('warehouse_confirmed_qty', 12, 3)->nullable();
            $table->decimal('discrepancy_qty', 12, 3)->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('return_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_return_lines');
    }
};
