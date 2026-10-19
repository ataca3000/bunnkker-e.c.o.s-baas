<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CR-PREP-001 â€” Manual Override Audit Trail.
 *
 * Supervisors may override the automatic warehouse assignment.
 * Every override is recorded in full â€” previous warehouse, new warehouse,
 * user, reason, and timestamp. The record is immutable.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('warehouse_assignment_overrides')) {
            return;
        }

        Schema::create('warehouse_assignment_overrides', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->uuid('previous_warehouse_id')->nullable();
            $table->uuid('new_warehouse_id');
            $table->text('reason');
            $table->uuid('overridden_by');
            $table->timestampTz('overridden_at');
            $table->timestampsTz();

            $table->index('order_id', 'idx_wao_order_id');
            $table->index('overridden_by', 'idx_wao_overridden_by');
            $table->index('overridden_at', 'idx_wao_overridden_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_assignment_overrides');
    }
};
