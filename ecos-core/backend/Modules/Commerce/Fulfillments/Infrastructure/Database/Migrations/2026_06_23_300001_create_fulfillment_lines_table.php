<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('fulfillment_lines')) {
            return;
        }

        Schema::create('fulfillment_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('fulfillment_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity', 12, 4);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fulfillment_lines');
    }
};
