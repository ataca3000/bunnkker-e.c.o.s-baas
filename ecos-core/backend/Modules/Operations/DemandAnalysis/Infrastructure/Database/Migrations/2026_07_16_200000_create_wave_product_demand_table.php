<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('wave_product_demand')) {
            return;
        }

        Schema::create('wave_product_demand', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->string('warehouse_id');
            $table->string('preparation_wave_id');
            $table->string('product_id');
            $table->string('product_name');
            $table->string('product_sku')->nullable();

            $table->decimal('required_qty', 12, 4)->default(0);
            $table->decimal('prepared_qty', 12, 4)->default(0);
            $table->decimal('remaining_qty', 12, 4)->default(0);
            $table->unsignedInteger('orders_count')->default(0);
            $table->decimal('completion_pct', 5, 2)->default(0);

            $table->string('data_hash', 64)->nullable();
            $table->timestamp('last_calculated_at')->useCurrent();
            $table->timestamps();

            $table->unique(['preparation_wave_id', 'product_id']);
            $table->index(['company_id', 'warehouse_id']);
            $table->index('preparation_wave_id');

            $table->foreign('preparation_wave_id')
                ->references('id')->on('preparation_waves')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wave_product_demand');
    }
};
