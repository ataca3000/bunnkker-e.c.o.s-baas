<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * CR-PREP-001 â€” Session â†” Order junction (auto-managed).
 *
 * When an order is assigned to a warehouse that has an active Preparation Session,
 * it is automatically attached here. Operators never select orders manually.
 * An order may belong to only one active session at a time.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('preparation_session_orders')) {
            return;
        }

        Schema::create('preparation_session_orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('preparation_session_id')
                ->constrained('preparation_sessions')
                ->restrictOnDelete();
            $table->foreignUuid('order_id')
                ->constrained('orders')
                ->restrictOnDelete();
            $table->string('order_number_snapshot', 50);
            $table->string('customer_name_snapshot')->nullable();
            $table->string('governorate_snapshot', 100)->nullable();
            $table->string('area_snapshot', 100)->nullable();
            $table->string('attachment_source', 50)->default('auto')
                ->comment('auto | manual_supervisor | system_recovery');
            $table->timestampTz('attached_at');
            $table->uuid('attached_by')->nullable()->comment('null = auto-attached by system');
            $table->timestampTz('detached_at')->nullable();
            $table->uuid('detached_by')->nullable();
            $table->string('detachment_reason', 255)->nullable();
            $table->timestampsTz();

            // One active attachment per order (cannot be in two active sessions)
            $table->unique(['order_id', 'preparation_session_id'], 'uq_pso_order_session');
            $table->index('preparation_session_id', 'idx_pso_session_id');
            $table->index('order_id', 'idx_pso_order_id');
            $table->index(['preparation_session_id', 'detached_at'], 'idx_pso_session_active');
        });

        DB::statement(
            'ALTER TABLE preparation_session_orders ADD CONSTRAINT chk_pso_attachment_source '
            ."CHECK (attachment_source IN ('auto','manual_supervisor','system_recovery'))",
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_session_orders');
    }
};
