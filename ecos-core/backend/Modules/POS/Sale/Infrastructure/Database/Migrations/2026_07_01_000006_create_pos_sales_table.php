<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_sales')) {
            return;
        }

        Schema::create('pos_sales', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('cart_id')->unique();
            $table->uuid('payment_id')->unique();
            $table->uuid('session_id');
            $table->uuid('shift_id');
            $table->uuid('terminal_id');
            $table->uuid('cashier_id');
            $table->uuid('customer_id')->nullable();
            $table->string('status', 50)->default('pending');
            $table->char('currency', 3);
            $table->string('receipt_number', 100)->unique();
            $table->json('lines')->nullable();
            $table->json('subtotal');
            $table->json('discount_total');
            $table->json('total');
            $table->json('amount_paid');
            $table->json('change_given');
            $table->json('payment_summaries')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('voided_reason', 500)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('session_id');
            $table->index('shift_id');
            $table->index('terminal_id');
            $table->index('cashier_id');
            $table->index('customer_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_sales');
    }
};
