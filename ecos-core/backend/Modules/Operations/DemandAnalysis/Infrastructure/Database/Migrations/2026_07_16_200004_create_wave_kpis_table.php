<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('wave_kpis')) {
            return;
        }

        Schema::create('wave_kpis', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->string('warehouse_id');
            $table->string('preparation_wave_id');

            $table->unsignedInteger('orders_count')->default(0);
            $table->unsignedInteger('products_count')->default(0);
            $table->unsignedInteger('materials_count')->default(0);
            $table->unsignedInteger('missing_materials_count')->default(0);
            $table->unsignedInteger('prepared_count')->default(0);
            $table->unsignedInteger('remaining_count')->default(0);
            $table->decimal('completion_pct', 5, 2)->default(0);

            $table->timestamp('last_calculated_at')->useCurrent();
            $table->timestamps();

            $table->unique('preparation_wave_id');
            $table->index(['company_id', 'warehouse_id']);

            $table->foreign('preparation_wave_id')
                ->references('id')->on('preparation_waves')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wave_kpis');
    }
};
