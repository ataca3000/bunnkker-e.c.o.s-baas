<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Bank reconciliations.
 *
 * A reconciliation run over one statement: it records the book balance, the
 * statement balance, and the difference at completion. It closes only when the
 * difference is fully explained by outstanding (unmatched) items.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_bank_reconciliations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('bank_account_id')->constrained('finance_bank_accounts')->cascadeOnDelete();
            $table->foreignId('bank_statement_id')->nullable()
                ->constrained('finance_bank_statements')->nullOnDelete();

            $table->date('reconciliation_date');
            $table->decimal('book_balance', 20, 4)->default(0);
            $table->decimal('statement_balance', 20, 4)->default(0);
            $table->decimal('difference', 20, 4)->default(0);

            // open | completed
            $table->string('status', 20)->default('open');
            $table->timestamp('completed_at')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('completed_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'bank_account_id', 'status'], 'finance_brec_account_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_bank_reconciliations');
    }
};
