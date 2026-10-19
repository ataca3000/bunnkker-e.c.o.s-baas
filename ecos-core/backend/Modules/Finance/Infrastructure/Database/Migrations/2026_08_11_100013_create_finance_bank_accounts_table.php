<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Bank accounts.
 *
 * A real bank account, linked 1:1 to a GL bank account. The book balance is the
 * GL account's balance; the bank's own balance arrives via statements and is
 * reconciled against it. No balance is stored here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_bank_accounts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->string('name', 200);
            $table->string('bank_name', 200)->nullable();
            $table->string('account_number', 64)->nullable();
            $table->string('iban', 64)->nullable();
            $table->string('swift', 32)->nullable();

            $table->foreignId('gl_account_id')->constrained('finance_accounts')->restrictOnDelete();
            $table->char('currency', 3)->default('EGP');
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index(['company_id', 'is_active'], 'finance_bank_company_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_bank_accounts');
    }
};
