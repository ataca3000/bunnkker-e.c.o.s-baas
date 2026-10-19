<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Delivery — the Delivery OS aggregate root.
 *
 * One row per order, spanning every attempt across every trip. Distribution's
 * DeliveryStop remains the per-trip planned visit and is referenced, never
 * copied. Delivery OS writes nothing in Distribution.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_deliveries')) {
            return;
        }

        Schema::create('delivery_deliveries', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            // One live delivery per order.
            $table->uuid('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();

            // Reference to the Distribution stop currently carrying this order.
            $table->foreignId('current_stop_id')->nullable()
                ->constrained('distribution_delivery_stops')->nullOnDelete();

            $table->string('status', 30)->default('pending');
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->unsignedSmallInteger('max_attempts')->default(3);
            $table->date('retry_cutoff_date')->nullable();

            // SLA
            $table->timestamp('promised_at')->nullable();
            $table->unsignedSmallInteger('sla_grace_minutes')->default(0);
            $table->timestamp('delivered_at')->nullable();
            $table->boolean('sla_breached')->default(false);
            $table->unsignedTinyInteger('escalation_level')->default(0);

            // Address correction required after an address-category failure.
            $table->boolean('requires_address_correction')->default(false);
            $table->timestamp('address_corrected_at')->nullable();

            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('order_id', 'delivery_deliveries_order_unique');
            $table->index(['company_id', 'status']);
            $table->index('promised_at');
            $table->index(['sla_breached', 'escalation_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_deliveries');
    }
};
