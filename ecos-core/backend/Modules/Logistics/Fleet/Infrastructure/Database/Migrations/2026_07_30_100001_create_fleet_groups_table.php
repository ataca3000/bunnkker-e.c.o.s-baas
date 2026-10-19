<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FleetGroup — a capability cohort (refrigerated, light vans, heavy trucks).
 *
 * Drives which maintenance template and inspection checklist apply, which is
 * why membership is versioned in fleet_unit_group_history: a historical cost or
 * compliance report must attribute to the group in force at the time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_groups', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('fleet_id')->constrained('fleet_fleets')->cascadeOnDelete();
            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['fleet_id', 'code'], 'fleet_groups_fleet_code_unique');
            $table->index(['company_id', 'is_active'], 'fleet_groups_company_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_groups');
    }
};
