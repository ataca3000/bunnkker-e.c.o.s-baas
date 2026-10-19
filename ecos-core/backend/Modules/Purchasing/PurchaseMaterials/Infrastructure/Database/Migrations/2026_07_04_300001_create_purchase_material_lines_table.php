<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('purchase_material_lines')) {
            return;
        }

        Schema::create('purchase_material_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('purchase_material_id')
                ->constrained('purchase_materials')
                ->cascadeOnDelete();
            $table->foreignUuid('product_id')
                ->constrained('products')
                ->restrictOnDelete();

            $table->decimal('requested_qty', 15, 4);
            $table->string('unit_label')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index('purchase_material_id');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_material_lines');
    }
};
