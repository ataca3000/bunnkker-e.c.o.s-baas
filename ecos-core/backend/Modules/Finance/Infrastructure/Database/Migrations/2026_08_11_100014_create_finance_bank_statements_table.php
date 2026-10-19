<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Bank statements.
 *
 * A statement for a period, carrying the bank's own opening and closing balance.
 * Its lines are matched against book movements during reconciliation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_bank_statements', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('bank_account_id')->constrained('finance_bank_accounts')->cascadeOnDelete();

            $table->string('reference', 120)->nullable();
            $table->date('statement_date');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();

            $table->decimal('opening_balance', 20, 4)->default(0);
            $table->decimal('closing_balance', 20, 4)->default(0);

            // imported | reconciling | reconciled
            $table->string('status', 20)->default('imported');

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'bank_account_id', 'statement_date'], 'finance_bs_account_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_bank_statements');
    }
};
