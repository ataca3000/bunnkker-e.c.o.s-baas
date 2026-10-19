<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Bank statement lines.
 *
 * One line of a statement. A signed amount (credit positive, debit negative) and
 * its matched state. When matched it points at the book transaction that clears
 * it; unmatched lines are the outstanding reconciliation items.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_bank_statement_lines', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('bank_statement_id')->constrained('finance_bank_statements')->cascadeOnDelete();

            $table->date('value_date');
            $table->string('description', 500)->nullable();
            $table->string('external_reference', 120)->nullable();
            // Signed: positive = money into the account, negative = out.
            $table->decimal('amount', 20, 4);

            // unmatched | matched | ignored
            $table->string('match_status', 20)->default('unmatched');
            // What the line was matched to in the books (a cash/bank transaction,
            // a journal entry, etc.). Opaque link kept generic on purpose.
            $table->string('matched_source_type', 40)->nullable();
            $table->unsignedBigInteger('matched_source_id')->nullable();
            $table->foreignId('reconciliation_id')->nullable()
                ->constrained('finance_bank_reconciliations')->nullOnDelete();
            $table->foreignId('matched_rule_id')->nullable()
                ->constrained('finance_bank_reconciliation_rules')->nullOnDelete();

            $table->timestamps();

            $table->index(['company_id', 'bank_statement_id', 'match_status'], 'finance_bsl_stmt_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_bank_statement_lines');
    }
};
