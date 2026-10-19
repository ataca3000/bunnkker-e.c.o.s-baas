<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('wave_manufacturing_demand')) {
            return;
        }

        Schema::create('wave_manufacturing_demand', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('company_id');
            $table->string('warehouse_id');
            $table->string('preparation_wave_id');
            $table->string('product_id');
            $table->string('product_name');

            $table->decimal('required_qty', 12, 4)->default(0);
            $table->decimal('planned_qty', 12, 4)->default(0);
            $table->decimal('manufacturing_qty', 12, 4)->default(0);
            $table->decimal('completed_qty', 12, 4)->default(0);
            $table->decimal('remaining_qty', 12, 4)->default(0);

            $table->timestamp('last_calculated_at')->useCurrent();
            $table->timestamps();

            $table->unique(['preparation_wave_id', 'product_id']);
            $table->index('preparation_wave_id');

            $table->foreign('preparation_wave_id')
                ->references('id')->on('preparation_waves')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wave_manufacturing_demand');
    }
};
