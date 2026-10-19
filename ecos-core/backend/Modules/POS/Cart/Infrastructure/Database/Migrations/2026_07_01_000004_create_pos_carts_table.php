<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_carts')) {
            return;
        }

        Schema::create('pos_carts', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // Cross-module UUID references — no FK constraints (no cross-module FKs per ADR-POS-001)
            $table->uuid('session_id');
            $table->uuid('shift_id');
            $table->uuid('terminal_id');
            $table->uuid('cashier_id');
            $table->uuid('customer_id')->nullable();

            $table->string('status', 50)->default('active');
            $table->char('currency', 3);

            // Lines stored as JSONB array — each element matches CartLine::toArray()
            $table->json('lines')->nullable();

            // Money fields as JSONB {amount, currency} — always present once the cart is opened
            $table->json('subtotal');
            $table->json('discount_total');
            $table->json('total');

            // Optional order-level discount
            $table->string('order_discount_type', 50)->nullable();
            $table->string('order_discount_value', 50)->nullable();

            // Assigned at complete(); unique across all completed carts
            $table->string('receipt_number', 100)->nullable()->unique();

            $table->text('notes')->nullable();

            $table->timestamp('held_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('expired_at')->nullable();

            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('session_id');
            $table->index('shift_id');
            $table->index('terminal_id');
            $table->index('cashier_id');
            $table->index('status');
            $table->index('customer_id');
        });

        // Uniqueness (one paying cart per session) is enforced at the application layer.
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_carts');
    }
};
