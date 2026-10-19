<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Supplier payments (money out).
 *
 * Posting a payment: DR the AP control account, CR the funding account
 * (cash/bank) — through the Posting Engine. Payments carry an approval step
 * (finance.ap.approve) before they post: money leaving the business is a
 * checker's decision.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_supplier_payments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->uuid('supplier_id');

            $table->string('number', 60);
            $table->date('payment_date');
            $table->decimal('amount', 20, 4);
            $table->char('currency', 3)->default('EGP');

            // The GL account the money left from (a cash/bank account).
            $table->foreignId('funding_account_id')->constrained('finance_accounts')->restrictOnDelete();
            $table->foreignId('ap_control_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            // draft | approved | posted | void
            $table->string('status', 20)->default('draft');

            $table->string('description', 500)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number'], 'finance_sp_company_number_unique');
            $table->index(['company_id', 'supplier_id', 'status'], 'finance_sp_supplier_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_supplier_payments');
    }
};
