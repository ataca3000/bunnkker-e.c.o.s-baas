<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Customer ledger (the AR subledger detail).
 *
 * ┌─ APPEND-ONLY · DERIVED BALANCE · RECONCILES TO THE GL CONTROL ───────────┐
 * │ One row per AR movement (invoice +, receipt −, credit note −, write-off  │
 * │ −), each linked to the GL journal that caused it. There is NO running    │
 * │ balance column — a customer's balance is SUM(amount), computed on read.  │
 * │ Because every entry corresponds to a control-account posting, the sum of │
 * │ all customers' entries reconciles to the AR control account in the GL.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_customer_ledger_entries', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->uuid('customer_id');

            $table->date('entry_date');
            // invoice | credit_note | debit_note | receipt | write_off
            $table->string('entry_type', 20);
            // Signed: + increases receivable (customer owes more), − decreases.
            $table->decimal('amount', 20, 4);

            // The source document and the GL journal — full traceability.
            $table->string('source_type', 40)->nullable();
            $table->uuid('source_id')->nullable();
            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            $table->string('description', 500)->nullable();
            $table->timestamps();

            $table->index(['company_id', 'customer_id', 'entry_date'], 'finance_cle_customer_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_customer_ledger_entries');
    }
};
