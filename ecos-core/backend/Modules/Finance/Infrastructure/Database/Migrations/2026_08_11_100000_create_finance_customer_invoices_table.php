<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Customer invoices (AR).
 *
 * ┌─ A SUBLEDGER DOCUMENT, NOT THE LEDGER ──────────────────────────────────┐
 * │ An invoice records what a customer owes; posting it moves the AR control │
 * │ account in the GL through the Posting Engine (AR never writes the GL).   │
 * │ document_type folds invoice / credit note / debit note into one shape.   │
 * │ There is NO stored balance here — settlement is derived from allocations.│
 * │                                                                          │
 * │ customer_id is an OPAQUE party reference (no FK to CRM/Sales) — F2 does   │
 * │ not integrate with operational modules; that is F3.                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_customer_invoices', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->uuid('customer_id');                 // opaque party reference

            // invoice | credit_note | debit_note
            $table->string('document_type', 20)->default('invoice');
            $table->string('number', 60);
            $table->date('invoice_date');
            $table->date('due_date')->nullable();
            $table->char('currency', 3)->default('EGP');

            $table->decimal('subtotal', 20, 4)->default(0);
            $table->decimal('tax_total', 20, 4)->default(0);
            $table->decimal('total', 20, 4)->default(0);

            // draft | posted | void
            $table->string('status', 20)->default('draft');

            // The AR control account this document posts against, and the journal
            // the Posting Engine produced.
            $table->foreignId('ar_control_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            $table->string('description', 500)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number'], 'finance_ci_company_number_unique');
            $table->index(['company_id', 'customer_id', 'status'], 'finance_ci_customer_status_idx');
            $table->index(['company_id', 'due_date'], 'finance_ci_due_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_customer_invoices');
    }
};
