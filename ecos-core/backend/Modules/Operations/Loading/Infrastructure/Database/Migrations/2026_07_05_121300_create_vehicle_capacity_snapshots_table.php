<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('vehicle_capacity_snapshots')) {
            return;
        }

        Schema::create('vehicle_capacity_snapshots', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_assignment_id')->unique()->constrained('vehicle_assignments')->restrictOnDelete();
            $table->timestampTz('checked_at');
            $table->uuid('checked_by');
            $table->integer('orders_count')->default(0);
            $table->decimal('planned_weight_kg', 18, 4);
            $table->decimal('planned_volume_m3', 18, 4);
            $table->decimal('vehicle_max_weight_kg', 18, 4);
            $table->decimal('vehicle_max_volume_m3', 18, 4);
            $table->decimal('weight_utilization_pct', 5, 2);
            $table->decimal('volume_utilization_pct', 5, 2);
            $table->decimal('order_utilization_pct', 5, 2);
            $table->decimal('overall_utilization_pct', 5, 2);
            $table->boolean('is_overloaded')->default(false);
            $table->text('overload_reason')->nullable();
            $table->integer('max_orders_limit');
            $table->uuid('policy_evaluation_id')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->uuid('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_capacity_snapshots');
    }
};
