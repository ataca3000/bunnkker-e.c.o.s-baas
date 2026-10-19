<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Supplier bill lines.
 *
 * Each line names the expense (or asset) account it debits and, optionally, the
 * tax code whose INPUT account carries recoverable VAT.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_supplier_bill_lines', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('supplier_bill_id')->constrained('finance_supplier_bills')->cascadeOnDelete();
            $table->foreignId('expense_account_id')->constrained('finance_accounts')->restrictOnDelete();

            $table->string('description', 500)->nullable();
            $table->decimal('quantity', 20, 4)->default(1);
            $table->decimal('unit_price', 20, 4)->default(0);
            $table->decimal('net_amount', 20, 4)->default(0);

            $table->foreignId('tax_code_id')->nullable()->constrained('finance_tax_codes')->nullOnDelete();
            $table->decimal('tax_amount', 20, 4)->default(0);

            $table->foreignId('cost_center_id')->nullable()->constrained('finance_cost_centers')->nullOnDelete();
            $table->uuid('branch_id')->nullable();

            $table->timestamps();

            $table->index('supplier_bill_id', 'finance_sbl_bill_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_supplier_bill_lines');
    }
};
