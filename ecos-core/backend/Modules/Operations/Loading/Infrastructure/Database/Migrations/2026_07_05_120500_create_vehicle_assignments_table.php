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
        if (Schema::hasTable('vehicle_assignments')) {
            return;
        }

        Schema::create('vehicle_assignments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('loading_session_id')->constrained('loading_sessions')->restrictOnDelete();
            $table->uuid('vehicle_plan_slot_id')->nullable();
            $table->uuid('vehicle_id');
            $table->string('vehicle_registration_snapshot', 50);
            $table->string('vehicle_type_snapshot', 50);
            $table->decimal('capacity_weight_kg_snapshot', 18, 4);
            $table->decimal('capacity_volume_m3_snapshot', 18, 4);
            $table->boolean('refrigerated_snapshot')->default(false);
            $table->string('assignment_number', 50);
            $table->string('status', 50);
            $table->integer('orders_count')->default(0);
            $table->decimal('loading_weight_kg', 18, 4)->default(0);
            $table->decimal('loading_volume_m3', 18, 4)->default(0);
            $table->timestampTz('loading_started_at')->nullable();
            $table->timestampTz('loading_completed_at')->nullable();
            $table->timestampTz('dispatched_at')->nullable();
            $table->uuid('dispatched_by')->nullable();
            $table->timestampTz('returned_at')->nullable();
            $table->timestampTz('reconciled_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['company_id', 'assignment_number'], 'uq_vehicle_assignments_company_assignment_number');
        });

        DB::statement("ALTER TABLE vehicle_assignments ADD CONSTRAINT chk_vehicle_assignments_status CHECK (status IN ('pending','loading','loading_complete','dispatched','returning','reconciling','reconciled','cancelled'))");
        DB::statement('ALTER TABLE vehicle_assignments ADD CONSTRAINT chk_vehicle_assignments_loading_weight_kg CHECK (loading_weight_kg >= 0)');
        DB::statement('ALTER TABLE vehicle_assignments ADD CONSTRAINT chk_vehicle_assignments_loading_volume_m3 CHECK (loading_volume_m3 >= 0)');
        DB::statement('ALTER TABLE vehicle_assignments ADD CONSTRAINT chk_vehicle_assignments_orders_count CHECK (orders_count >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_assignments');
    }
};
