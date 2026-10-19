<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Customer receipts (money in).
 *
 * Posting a receipt: DR the deposit account (cash/bank), CR the AR control
 * account — through the Posting Engine. The receipt is then allocated against
 * open invoices; any unallocated remainder sits on account (derived, not
 * stored).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_customer_receipts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->uuid('customer_id');

            $table->string('number', 60);
            $table->date('receipt_date');
            $table->decimal('amount', 20, 4);
            $table->char('currency', 3)->default('EGP');

            // The GL account the money landed in (a cash/bank account).
            $table->foreignId('deposit_account_id')->constrained('finance_accounts')->restrictOnDelete();
            $table->foreignId('ar_control_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            // draft | posted | void
            $table->string('status', 20)->default('draft');

            $table->string('description', 500)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number'], 'finance_cr_company_number_unique');
            $table->index(['company_id', 'customer_id', 'status'], 'finance_cr_customer_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_customer_receipts');
    }
};
