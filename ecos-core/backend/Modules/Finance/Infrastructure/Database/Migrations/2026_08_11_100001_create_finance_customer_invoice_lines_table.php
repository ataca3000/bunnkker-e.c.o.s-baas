<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Customer invoice lines.
 *
 * Each line names the revenue account it credits and, optionally, the tax code
 * whose output account carries the VAT. The posting is built from these lines:
 * DR AR control (total), CR each revenue account (net), CR output tax (tax).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_customer_invoice_lines', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('customer_invoice_id')->constrained('finance_customer_invoices')->cascadeOnDelete();
            $table->foreignId('revenue_account_id')->constrained('finance_accounts')->restrictOnDelete();

            $table->string('description', 500)->nullable();
            $table->decimal('quantity', 20, 4)->default(1);
            $table->decimal('unit_price', 20, 4)->default(0);
            $table->decimal('net_amount', 20, 4)->default(0);

            $table->foreignId('tax_code_id')->nullable()->constrained('finance_tax_codes')->nullOnDelete();
            $table->decimal('tax_amount', 20, 4)->default(0);

            $table->foreignId('cost_center_id')->nullable()->constrained('finance_cost_centers')->nullOnDelete();
            $table->uuid('branch_id')->nullable();

            $table->timestamps();

            $table->index('customer_invoice_id', 'finance_cil_invoice_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_customer_invoice_lines');
    }
};
