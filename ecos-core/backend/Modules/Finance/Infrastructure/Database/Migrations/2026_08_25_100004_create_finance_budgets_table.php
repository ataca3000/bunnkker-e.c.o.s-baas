<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Budgets (year + version + scenario).
 *
 * A budget belongs to a fiscal year and carries a version and a scenario (base /
 * optimistic / pessimistic), so many plans can coexist. It follows a draft →
 * approved workflow. A budget NEVER affects the ledger; it is a plan the Budget
 * Control engine compares actuals against, read-only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_budgets', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('fiscal_year_id')->constrained('finance_fiscal_years')->cascadeOnDelete();

            $table->string('name', 200);
            $table->string('version', 40)->default('v1');
            $table->string('scenario', 40)->default('base');
            // draft | approved | archived
            $table->string('status', 20)->default('draft');
            $table->char('currency', 3)->default('EGP');
            $table->string('description', 500)->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'fiscal_year_id', 'name', 'version', 'scenario'], 'finance_budget_unique');
            $table->index(['company_id', 'fiscal_year_id', 'status'], 'finance_budget_year_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_budgets');
    }
};
