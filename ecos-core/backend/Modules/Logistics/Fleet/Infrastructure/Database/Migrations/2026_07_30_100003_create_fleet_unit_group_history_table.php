<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Versioned group membership.
 *
 * A vehicle that moved from "Light Vans" to "Refrigerated" in March must have
 * its January costs attributed to the group it was actually in. Without this
 * table, every historical group report silently rewrites itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_unit_group_history', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('fleet_unit_id')->constrained('fleet_units')->cascadeOnDelete();
            $table->foreignId('fleet_group_id')->constrained('fleet_groups')->cascadeOnDelete();

            $table->timestamp('effective_from');
            $table->timestamp('effective_to')->nullable();
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('changed_by')->nullable();
            $table->timestamps();

            $table->index(['fleet_unit_id', 'effective_from'], 'fleet_unit_group_hist_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_unit_group_history');
    }
};
