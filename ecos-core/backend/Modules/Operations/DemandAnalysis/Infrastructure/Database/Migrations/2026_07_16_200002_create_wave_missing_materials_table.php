<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('wave_missing_materials')) {
            return;
        }

        Schema::create('wave_missing_materials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->string('warehouse_id');
            $table->string('preparation_wave_id');
            $table->string('material_id');
            $table->string('material_name');

            $table->decimal('missing_qty', 12, 4)->default(0);
            $table->unsignedInteger('affected_orders_count')->default(0);
            $table->string('priority');           // critical | high | medium | low
            $table->string('procurement_status')->nullable();

            $table->timestamp('last_calculated_at')->useCurrent();
            $table->timestamps();

            $table->unique(['preparation_wave_id', 'material_id']);
            $table->index('preparation_wave_id');

            $table->foreign('preparation_wave_id')
                ->references('id')->on('preparation_waves')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wave_missing_materials');
    }
};
