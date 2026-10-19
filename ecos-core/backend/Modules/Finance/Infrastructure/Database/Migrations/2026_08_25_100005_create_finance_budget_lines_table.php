<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Budget lines.
 *
 * One planned amount for an account, optionally scoped to a dimension
 * (department / branch / cost center / project) and a period. An annual line
 * omits the period; a phased line names period_number 1..12. Actuals are matched
 * to a line by (account, dimension, period) at read time — never stored on it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_budget_lines', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('budget_id')->constrained('finance_budgets')->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('finance_accounts')->restrictOnDelete();

            // company | department | branch | cost_center | project
            $table->string('dimension_type', 20)->default('company');
            $table->string('dimension_id', 64)->nullable();
            $table->unsignedTinyInteger('period_number')->nullable(); // null = annual

            $table->decimal('amount', 20, 4)->default(0);
            $table->string('notes', 300)->nullable();
            $table->timestamps();

            $table->index(['budget_id', 'account_id'], 'finance_bline_budget_account_idx');
            $table->index(['dimension_type', 'dimension_id'], 'finance_bline_dimension_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_budget_lines');
    }
};
