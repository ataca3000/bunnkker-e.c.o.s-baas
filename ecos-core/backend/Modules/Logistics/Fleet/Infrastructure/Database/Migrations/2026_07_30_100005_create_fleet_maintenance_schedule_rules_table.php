<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ServiceInterval, decomposed.
 *
 * A plan may carry several triggers — "every 10,000 km OR 6 months, whichever
 * first" is two rows. Whichever fires first wins.
 *
 * Directive 5 / D3: an engine-hours rule needs a source that may never exist,
 * so MaintenanceSchedulingService refuses a plan whose only rule is engine
 * hours. A plan that can only be evaluated with telemetry present is invalid.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_maintenance_schedule_rules', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('maintenance_plan_id')
                ->constrained('fleet_maintenance_plans')->cascadeOnDelete();

            $table->string('trigger', 20);       // MaintenanceTrigger
            $table->decimal('interval_value', 12, 1);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['maintenance_plan_id', 'trigger'], 'fleet_rule_plan_trigger_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_maintenance_schedule_rules');
    }
};
