<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_count_lines')) {
            return;
        }

        Schema::create('inventory_count_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('session_id')->index();
            $table->uuid('product_id')->index();
            $table->uuid('inventory_item_id')->nullable()->index();

            // System vs counted quantities (system_qty is hidden from mobile counters)
            $table->decimal('system_qty', 15, 4)->default(0);
            $table->decimal('counted_qty', 15, 4)->nullable();

            // Computed: counted_qty - system_qty (can be positive or negative)
            $table->decimal('variance_qty', 15, 4)->nullable();
            $table->decimal('variance_value', 15, 2)->nullable();

            $table->text('notes')->nullable();
            $table->string('photo_path')->nullable();

            $table->timestamps();

            // FKs
            $table->foreign('session_id')->references('id')->on('inventory_count_sessions')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();

            $table->unique(['session_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_count_lines');
    }
};
