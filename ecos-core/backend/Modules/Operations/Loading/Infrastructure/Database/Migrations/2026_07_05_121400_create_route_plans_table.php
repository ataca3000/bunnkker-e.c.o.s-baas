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
        if (Schema::hasTable('route_plans')) {
            return;
        }

        Schema::create('route_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_assignment_id')->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('loading_session_id');
            $table->uuid('vehicle_id');
            $table->foreignUuid('driver_assignment_id')->constrained('driver_assignments')->restrictOnDelete();
            $table->string('route_number', 50);
            $table->string('status', 50)->default('planned');
            $table->integer('version')->default(1);
            $table->uuid('superseded_by_id')->nullable();
            $table->integer('stops_count')->default(0);
            $table->decimal('total_distance_km', 10, 4)->nullable();
            $table->integer('estimated_duration_min')->nullable();
            $table->decimal('optimization_score', 5, 2)->nullable();
            $table->string('optimization_algorithm', 100)->nullable();
            $table->timestampTz('planned_departure_at')->nullable();
            $table->timestampTz('actual_departure_at')->nullable();
            $table->timestampTz('actual_return_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['company_id', 'route_number'], 'uq_route_plans_company_route_number');
        });

        DB::statement("ALTER TABLE route_plans ADD CONSTRAINT chk_route_plans_status CHECK (status IN ('planned','in_progress','completed','cancelled','superseded'))");
        DB::statement('ALTER TABLE route_plans ADD CONSTRAINT chk_route_plans_version CHECK (version >= 1)');
        DB::statement('ALTER TABLE route_plans ADD CONSTRAINT chk_route_plans_total_distance_km CHECK (total_distance_km IS NULL OR total_distance_km >= 0)');
        DB::statement('ALTER TABLE route_plans ADD CONSTRAINT chk_route_plans_optimization_score CHECK (optimization_score IS NULL OR (optimization_score >= 0 AND optimization_score <= 100))');
    }

    public function down(): void
    {
        Schema::dropIfExists('route_plans');
    }
};
