<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('wave_material_demand')) {
            return;
        }

        Schema::create('wave_material_demand', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->string('warehouse_id');
            $table->string('preparation_wave_id');
            $table->string('material_id');
            $table->string('material_name');
            $table->string('material_sku')->nullable();

            $table->decimal('required_qty', 12, 4)->default(0);
            $table->decimal('available_qty', 12, 4)->default(0);
            $table->decimal('reserved_qty', 12, 4)->default(0);
            $table->decimal('expected_today', 12, 4)->default(0);
            $table->decimal('in_transit_qty', 12, 4)->default(0);
            $table->decimal('missing_qty', 12, 4)->default(0);
            $table->decimal('coverage_pct', 5, 2)->default(0);

            $table->string('data_hash', 64)->nullable();
            $table->timestamp('last_calculated_at')->useCurrent();
            $table->timestamps();

            $table->unique(['preparation_wave_id', 'material_id']);
            $table->index(['company_id', 'warehouse_id']);
            $table->index('preparation_wave_id');

            $table->foreign('preparation_wave_id')
                ->references('id')->on('preparation_waves')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wave_material_demand');
    }
};
