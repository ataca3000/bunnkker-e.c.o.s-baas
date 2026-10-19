<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Receipt allocations (AR matching).
 *
 * Append-only links between a receipt and the invoices it settles. One receipt
 * may allocate across many invoices (multiple matching); a partial allocation
 * leaves the invoice open; the unallocated receipt balance is on account. The
 * outstanding figures are DERIVED by summing these rows — never stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_receipt_allocations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('receipt_id')->constrained('finance_customer_receipts')->cascadeOnDelete();
            $table->foreignId('customer_invoice_id')->constrained('finance_customer_invoices')->cascadeOnDelete();

            $table->decimal('amount', 20, 4);

            $table->timestamp('allocated_at');
            $table->unsignedBigInteger('allocated_by')->nullable();
            $table->timestamps();

            $table->index('receipt_id', 'finance_ra_receipt_idx');
            $table->index('customer_invoice_id', 'finance_ra_invoice_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_receipt_allocations');
    }
};
