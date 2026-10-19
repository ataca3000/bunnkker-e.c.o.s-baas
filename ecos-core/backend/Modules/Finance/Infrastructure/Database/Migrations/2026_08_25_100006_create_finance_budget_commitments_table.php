<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Budget commitments (encumbrances).
 *
 * A commitment reserves budget before it becomes an actual — an approved
 * purchase order, an open requisition. Availability is budget − actual −
 * committed, so a commitment consumes budget without ever touching the ledger.
 * Releasing a commitment (its actual has posted, or it was cancelled) flips its
 * status; the amount is never mutated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_budget_commitments', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('budget_id')->nullable()->constrained('finance_budgets')->nullOnDelete();
            $table->foreignId('account_id')->constrained('finance_accounts')->restrictOnDelete();

            $table->string('dimension_type', 20)->default('company');
            $table->string('dimension_id', 64)->nullable();
            $table->unsignedTinyInteger('period_number')->nullable();

            $table->decimal('amount', 20, 4);
            $table->string('source_type', 60)->nullable();
            $table->string('source_id', 64)->nullable();
            $table->string('reference', 120)->nullable();

            // committed | released
            $table->string('status', 20)->default('committed');
            $table->unsignedBigInteger('committed_by')->nullable();
            $table->timestamp('committed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'account_id', 'status'], 'finance_bcommit_account_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_budget_commitments');
    }
};
