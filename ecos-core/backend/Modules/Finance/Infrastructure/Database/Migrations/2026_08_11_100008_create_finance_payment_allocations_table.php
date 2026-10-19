<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Payment allocations (AP matching).
 *
 * Append-only links between a supplier payment and the bills it settles.
 * Partial, full and multiple-bill matching; any unallocated remainder is on
 * account. Outstanding is derived from these rows — never stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_payment_allocations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('payment_id')->constrained('finance_supplier_payments')->cascadeOnDelete();
            $table->foreignId('supplier_bill_id')->constrained('finance_supplier_bills')->cascadeOnDelete();

            $table->decimal('amount', 20, 4);

            $table->timestamp('allocated_at');
            $table->unsignedBigInteger('allocated_by')->nullable();
            $table->timestamps();

            $table->index('payment_id', 'finance_pa_payment_idx');
            $table->index('supplier_bill_id', 'finance_pa_bill_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_payment_allocations');
    }
};
