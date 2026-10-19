<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_receipts')) {
            return;
        }

        Schema::create('pos_receipts', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Identity
            $table->string('receipt_number', 100)->unique();
            $table->string('type', 20)->default('sale');
            $table->string('status', 20)->default('issued');

            // Transaction reference (no FK constraints per ADR-POS-001)
            $table->string('original_transaction_id', 36);
            $table->string('original_transaction_number', 100);

            // Terminal / Session / Shift context
            $table->string('terminal_id', 36);
            $table->string('session_id', 36)->nullable();
            $table->string('shift_id', 36)->nullable();

            // Actors
            $table->string('cashier_id', 36);
            $table->string('cashier_name', 255)->nullable();
            $table->string('customer_id', 36)->nullable();
            $table->string('customer_name', 255)->nullable();

            // Currency
            $table->char('currency', 3);

            // Template (no FK constraint per ADR-POS-001)
            $table->uuid('template_id')->nullable();

            // Immutable snapshot (JSONB for efficient querying)
            $table->json('line_items')->nullable();
            $table->json('totals');
            $table->json('payments')->nullable();

            // Reprint audit
            $table->json('reprints')->nullable();
            $table->unsignedInteger('reprint_count')->default(0);

            // Void tracking
            $table->string('void_reason', 500)->nullable();
            $table->string('voided_by', 36)->nullable();
            $table->timestampTz('voided_at')->nullable();

            // Timestamps
            $table->timestampTz('issued_at');
            $table->timestampsTz();

            // Query indexes
            $table->index('original_transaction_id');
            $table->index('terminal_id');
            $table->index('cashier_id');
            $table->index('customer_id');
            $table->index('status');
            $table->index('issued_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_receipts');
    }
};
