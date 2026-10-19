<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Driver ↔ vehicle assignment ledger.
 *
 * Rows are append-only in spirit: releasing an assignment stamps released_at
 * and clears active_flag, so the full history is preserved (spec requirement).
 *
 * BR-6 (one driver → one active vehicle) and BR-7 (one vehicle → one active
 * driver) are enforced by the DATABASE, not just the service layer:
 *
 *   active_flag is 1 while the assignment is live and NULL once released.
 *   Both MySQL and PostgreSQL treat NULLs as distinct in a unique index, so
 *   unlimited released rows coexist while at most one active row may exist
 *   per driver and per vehicle. A concurrent double-assign hits a unique
 *   violation rather than silently creating a second active row.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_driver_vehicle_assignments')) {
            return;
        }

        Schema::create('logistics_driver_vehicle_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')
                ->constrained('logistics_drivers')
                ->cascadeOnDelete();
            $table->foreignId('vehicle_id')
                ->constrained('logistics_vehicles')
                ->cascadeOnDelete();

            $table->timestamp('assigned_at');
            $table->timestamp('released_at')->nullable();

            /** 1 = currently assigned, NULL = released. Drives the unique indexes below. */
            $table->unsignedTinyInteger('active_flag')->nullable()->default(1);

            $table->string('assigned_by', 150)->nullable();
            $table->string('released_by', 150)->nullable();
            $table->string('release_reason', 255)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['driver_id', 'active_flag'], 'driver_one_active_vehicle_unique');
            $table->unique(['vehicle_id', 'active_flag'], 'vehicle_one_active_driver_unique');
            $table->index(['driver_id', 'assigned_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_driver_vehicle_assignments');
    }
};
