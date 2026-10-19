<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bills_of_materials')) {
            return;
        }

        Schema::create('bills_of_materials', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('bom_number', 50)->unique();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->string('version', 20)->default('1.0');
            $table->boolean('is_active')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('bill_of_material_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('bom_id')->constrained('bills_of_materials')->cascadeOnDelete();
            $table->foreignUuid('raw_material_id')->constrained('products')->restrictOnDelete();
            $table->decimal('quantity', 12, 4);
            $table->decimal('waste_percentage', 5, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_of_material_lines');
        Schema::dropIfExists('bills_of_materials');
    }
};
