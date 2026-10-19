<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Cash accounts.
 *
 * A till or petty-cash box, linked 1:1 to a GL cash account. Its balance is the
 * GL account's balance — never stored here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_cash_accounts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->uuid('branch_id')->nullable();

            $table->string('code', 40);
            $table->string('name', 200);
            $table->foreignId('gl_account_id')->constrained('finance_accounts')->restrictOnDelete();
            $table->char('currency', 3)->default('EGP');
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['company_id', 'code'], 'finance_cash_company_code_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_cash_accounts');
    }
};
