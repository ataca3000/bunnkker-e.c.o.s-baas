<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Supplier ledger (the AP subledger detail).
 *
 * The mirror of the customer ledger: append-only, no stored balance, every entry
 * linked to its GL journal. A supplier's balance is SUM(amount), and the sum of
 * all suppliers reconciles to the AP control account in the GL. A positive
 * amount increases what WE owe (a bill); a negative decreases it (a payment).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_supplier_ledger_entries', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->uuid('supplier_id');

            $table->date('entry_date');
            // bill | credit_note | debit_note | payment
            $table->string('entry_type', 20);
            $table->decimal('amount', 20, 4);

            $table->string('source_type', 40)->nullable();
            $table->uuid('source_id')->nullable();
            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            $table->string('description', 500)->nullable();
            $table->timestamps();

            $table->index(['company_id', 'supplier_id', 'entry_date'], 'finance_sle_supplier_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_supplier_ledger_entries');
    }
};
