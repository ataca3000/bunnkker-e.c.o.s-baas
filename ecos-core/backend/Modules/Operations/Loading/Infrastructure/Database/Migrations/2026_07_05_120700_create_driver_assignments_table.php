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
        if (Schema::hasTable('driver_assignments')) {
            return;
        }

        Schema::create('driver_assignments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_assignment_id')->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('loading_session_id');
            $table->uuid('vehicle_id');
            $table->uuid('driver_id');
            $table->string('driver_name_snapshot', 255);
            $table->string('driver_phone_snapshot', 50)->nullable();
            $table->string('status', 50)->default('assigned');
            $table->string('assignment_type', 50)->default('primary');
            $table->timestampTz('assigned_at')->useCurrent();
            $table->uuid('assigned_by');
            $table->timestampTz('departure_time_planned')->nullable();
            $table->timestampTz('departure_time_actual')->nullable();
            $table->timestampTz('return_time_actual')->nullable();
            $table->timestampTz('reassigned_at')->nullable();
            $table->uuid('reassigned_by')->nullable();
            $table->text('reassignment_reason')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');
        });

        DB::statement("ALTER TABLE driver_assignments ADD CONSTRAINT chk_driver_assignments_status CHECK (status IN ('assigned','on_trip','returned','reconciled','cancelled','reassigned'))");
        DB::statement("ALTER TABLE driver_assignments ADD CONSTRAINT chk_driver_assignments_assignment_type CHECK (assignment_type IN ('primary','substitute'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_assignments');
    }
};
