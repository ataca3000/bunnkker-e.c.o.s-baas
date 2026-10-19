<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An open fault. A `critical` defect makes the vehicle unfit immediately.
 *
 * Defects arrive from a failed inspection item or from a driver report. Either
 * way they are the corrective half of maintenance: resolving one normally means
 * raising a corrective work order.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_defects', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->foreignId('inspection_id')->nullable()
                ->constrained('fleet_inspections')->nullOnDelete();
            $table->foreignId('work_order_id')->nullable()
                ->constrained('fleet_work_orders')->nullOnDelete();
            $table->uuid('company_id')->nullable();

            $table->string('status', 20)->default('open');
            $table->string('severity', 20)->default('major');
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->json('photos')->nullable();

            $table->timestamp('reported_at');
            $table->unsignedBigInteger('reported_by')->nullable();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();

            // Dismissing a critical defect requires fleet.health.override and a
            // reason — the override discipline is enforced, not advisory.
            $table->text('dismissal_reason')->nullable();
            $table->unsignedBigInteger('dismissed_by')->nullable();

            $table->timestamps();

            $table->index(['fleet_unit_id', 'severity', 'status'], 'fleet_defect_fitness_idx');
            $table->index(['company_id', 'status'], 'fleet_defect_company_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_defects');
    }
};
