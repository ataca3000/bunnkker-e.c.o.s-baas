<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F3. Account-role map (the no-hardcoding bridge).
 *
 * ┌─ CONFIGURATION, NOT CODE ───────────────────────────────────────────────┐
 * │ A posting rule names ROLES ("inventory", "grni", "cogs", "vat_output"),   │
 * │ never account codes. This table maps a role to a real GL account per      │
 * │ company. That is how an operational event becomes a journal WITHOUT a      │
 * │ single hardcoded account anywhere in the pipeline: rules are shared        │
 * │ templates, the accounts are a company's own choice, resolved here.         │
 * │ A role with no mapping is a clear, actionable failure — never a guess.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_account_roles', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->string('role', 60);
            $table->foreignId('account_id')->constrained('finance_accounts')->restrictOnDelete();
            $table->string('description', 300)->nullable();

            $table->timestamps();

            $table->unique(['company_id', 'role'], 'finance_arole_company_role_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_account_roles');
    }
};
