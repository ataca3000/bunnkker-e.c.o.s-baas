<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_returns')) {
            return;
        }

        Schema::create('pos_returns', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Cross-module UUID references — no FK constraints (ADR-POS-001)
            $table->uuid('sale_id')->nullable(false)->index();
            $table->string('original_receipt_number', 100)->nullable(false);

            $table->uuid('session_id')->nullable(false)->index();
            $table->uuid('shift_id')->nullable(false)->index();
            $table->uuid('terminal_id')->nullable(false)->index();
            $table->uuid('cashier_id')->nullable(false)->index();
            $table->uuid('customer_id')->nullable()->index();

            $table->string('return_number', 100)->nullable(false)->unique();
            $table->string('status', 50)->nullable(false)->default('pending')->index();
            $table->char('currency', 3)->nullable(false);

            // Snapshot of returned lines and computed totals (JSONB)
            $table->json('lines')->nullable(false);
            $table->json('refund_total')->nullable(false);

            $table->string('refund_method', 50)->nullable(false);
            $table->text('notes')->nullable();

            $table->timestamp('processed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_reason', 500)->nullable();

            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_returns');
    }
};
