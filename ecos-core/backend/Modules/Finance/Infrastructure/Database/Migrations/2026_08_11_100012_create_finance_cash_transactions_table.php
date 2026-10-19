<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Cash transactions.
 *
 * Every cash movement (receipt, payment, adjustment, transfer) posts to the GL
 * through the Posting Engine and records the journal here for a complete audit
 * trail. A transfer names the counterparty cash account; the pair of postings
 * keeps the GL balanced.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_cash_transactions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('cash_account_id')->constrained('finance_cash_accounts')->cascadeOnDelete();
            $table->foreignId('cash_session_id')->nullable()
                ->constrained('finance_cash_sessions')->nullOnDelete();

            // receipt | payment | adjustment | transfer_in | transfer_out
            $table->string('transaction_type', 20);
            $table->decimal('amount', 20, 4);
            $table->date('transaction_date');

            // The other GL account of the movement (income/expense, or the
            // counterparty cash account's GL for a transfer).
            $table->foreignId('counterparty_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            $table->string('description', 500)->nullable();
            $table->string('status', 20)->default('posted'); // posted | void
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'cash_account_id', 'transaction_date'], 'finance_ct_account_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_cash_transactions');
    }
};
