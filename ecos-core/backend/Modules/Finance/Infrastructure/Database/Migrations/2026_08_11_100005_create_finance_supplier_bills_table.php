<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Supplier bills (AP).
 *
 * The mirror of the customer invoice. Posting a bill: DR expense/asset accounts
 * + recoverable VAT, CR the AP control account — through the Posting Engine (AP
 * never writes the GL). supplier_id is an opaque party reference (no FK to
 * Procurement); F2 does not integrate with operational modules.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_supplier_bills', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->uuid('supplier_id');

            // bill | credit_note | debit_note
            $table->string('document_type', 20)->default('bill');
            $table->string('number', 60);
            $table->date('bill_date');
            $table->date('due_date')->nullable();
            $table->char('currency', 3)->default('EGP');

            $table->decimal('subtotal', 20, 4)->default(0);
            $table->decimal('tax_total', 20, 4)->default(0);
            $table->decimal('total', 20, 4)->default(0);

            $table->string('status', 20)->default('draft'); // draft | posted | void

            $table->foreignId('ap_control_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();
            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            $table->string('description', 500)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'number'], 'finance_sb_company_number_unique');
            $table->index(['company_id', 'supplier_id', 'status'], 'finance_sb_supplier_status_idx');
            $table->index(['company_id', 'due_date'], 'finance_sb_due_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_supplier_bills');
    }
};
