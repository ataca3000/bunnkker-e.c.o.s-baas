<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Maintenance ledger.
 *
 * BR-8 — records are immutable once written except for users holding the
 * maintenance-management permission. The API exposes no unguarded update or
 * delete path, and every amendment stamps amended_by/amended_at so the change
 * is attributable rather than silent.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_vehicle_maintenance_records')) {
            return;
        }

        Schema::create('logistics_vehicle_maintenance_records', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('vehicle_id')
                ->constrained('logistics_vehicles')
                ->cascadeOnDelete();

            $table->date('performed_on');
            $table->string('type', 30);
            $table->text('description')->nullable();
            $table->decimal('cost', 12, 2)->default(0);
            $table->string('currency', 3)->default('EGP');
            $table->string('vendor', 150)->nullable();
            $table->date('next_maintenance_date')->nullable();
            $table->text('notes')->nullable();

            $table->string('recorded_by', 150)->nullable();
            $table->string('amended_by', 150)->nullable();
            $table->timestamp('amended_at')->nullable();

            $table->timestamps();

            // Explicit names: the table name is 37 characters, so Laravel's
            // auto-generated identifiers (67 and 65 chars) exceed MySQL's 64-char
            // limit and the migration aborts. Same indexes, same columns.
            $table->index(['vehicle_id', 'performed_on'], 'idx_lvmr_vehicle_performed');
            $table->index('next_maintenance_date', 'idx_lvmr_next_maintenance');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_vehicle_maintenance_records');
    }
};
