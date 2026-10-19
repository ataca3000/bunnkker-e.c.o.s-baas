<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_return_lines')) {
            return;
        }

        Schema::create('customer_return_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('customer_return_id')->index();
            $table->uuid('order_line_id')->nullable()->index();
            $table->uuid('product_id')->index();
            $table->string('sku_snapshot', 100);
            $table->string('name_snapshot', 255);
            $table->decimal('quantity_returned', 14, 4);
            $table->decimal('unit_cost_snapshot', 14, 4)->nullable();
            $table->string('condition', 20)->default('sellable'); // sellable | damaged | destroyed
            $table->text('inspection_notes')->nullable();
            $table->timestamps();

            $table->foreign('customer_return_id')->references('id')->on('customer_returns')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_return_lines');
    }
};
