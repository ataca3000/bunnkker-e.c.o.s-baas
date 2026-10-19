<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('preparation_wave_orders')) {
            return;
        }

        Schema::create('preparation_wave_orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete();
            $table->uuid('order_id');
            $table->string('order_number', 50);
            $table->timestampTz('order_confirmed_at');
            $table->string('customer_name_snapshot', 255)->nullable();
            $table->string('delivery_zone_snapshot', 100)->nullable();
            $table->timestampTz('added_at')->useCurrent();
            $table->uuid('added_by');

            $table->unique(['preparation_wave_id', 'order_id'], 'uq_preparation_wave_orders_wave_order');
            $table->index('preparation_wave_id', 'idx_preparation_wave_orders_wave_id');
            $table->index('order_id', 'idx_preparation_wave_orders_order_id');
            $table->index('company_id', 'idx_preparation_wave_orders_company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_wave_orders');
    }
};
