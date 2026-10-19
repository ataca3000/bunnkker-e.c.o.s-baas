<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_abc_classifications')) {
            return;
        }

        Schema::create('inventory_abc_classifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('product_id')->unique()->index();
            $table->enum('classification', ['A', 'B', 'C']);
            $table->decimal('annual_consumption_value', 15, 2)->default(0);
            $table->decimal('cumulative_percentage', 8, 4)->default(0);
            $table->timestamp('calculated_at');

            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_abc_classifications');
    }
};
