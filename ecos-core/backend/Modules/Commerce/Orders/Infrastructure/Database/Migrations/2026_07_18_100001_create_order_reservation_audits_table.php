<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-INV-RESERVATION-LIFECYCLE-001 — Part 16
 *
 * Full audit trail for every reservation state transition.
 * Immutable + actor-stamped (ADR-011 pattern).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_reservation_audits')) {
            return;
        }

        Schema::create('order_reservation_audits', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('from_status', 30)->nullable()->comment('NULL = first reservation attempt');
            $table->string('to_status', 30);
            $table->string('reason', 500)->nullable();
            $table->string('warehouse_id')->nullable()->comment('Warehouse involved in this transition');
            $table->string('vehicle_id')->nullable()->comment('Vehicle involved in loading/transfer transitions');
            $table->json('meta')->nullable()->comment('Arbitrary context: quantities, SKUs, etc.');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_type', 50)->nullable()->comment('user | system | driver | webhook');
            $table->timestamps();

            $table->index(['order_id', 'created_at']);
            $table->index('to_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_reservation_audits');
    }
};
