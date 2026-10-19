<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('vehicle_plan_adjustment_log')) {
            return;
        }

        Schema::create('vehicle_plan_adjustment_log', function (Blueprint $table): void {
            $table->char('id', 26)->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_plan_id')->constrained('vehicle_plans')->restrictOnDelete();
            $table->string('action_type', 50);
            $table->uuid('actor_id');
            $table->uuid('slot_id_from')->nullable();
            $table->uuid('slot_id_to')->nullable();
            $table->uuid('order_id')->nullable();
            $table->uuid('vehicle_id_before')->nullable();
            $table->uuid('vehicle_id_after')->nullable();
            $table->jsonb('before_state')->nullable();
            $table->jsonb('after_state')->nullable();
            $table->text('reason');
            $table->timestampTz('recorded_at')->useCurrent();
        });

        DB::statement("ALTER TABLE vehicle_plan_adjustment_log ADD CONSTRAINT chk_vehicle_plan_adjustment_log_action_type CHECK (action_type IN ('merge_slots','split_slot','move_order','create_slot','delete_slot','assign_vehicle','unassign_vehicle','approve_plan','replan_triggered'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_plan_adjustment_log');
    }
};
