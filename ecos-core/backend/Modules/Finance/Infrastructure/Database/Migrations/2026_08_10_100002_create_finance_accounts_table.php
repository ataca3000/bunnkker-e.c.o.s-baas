<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Chart of Accounts.
 *
 * The account taxonomy. Type fixes the normal balance side and the statement it
 * lands on. Only a `postable` account may appear on a journal line; a parent
 * (rollup) account never receives postings directly. A `control` account is the
 * GL side of a subledger and is moved ONLY by that subledger's postings (F3);
 * in F1 the flag and mapping exist so the invariant can be designed-in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_accounts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');

            $table->string('code', 40);
            $table->string('name', 200);
            $table->string('name_ar', 200)->nullable();   // Arabic-first statutory reporting

            // asset | liability | equity | revenue | expense
            $table->string('account_type', 20);
            // debit | credit — derived from type, stored for query simplicity
            $table->string('normal_balance', 10);

            // Rollup hierarchy. A parent is never postable.
            $table->foreignId('parent_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();
            $table->boolean('is_postable')->default(true);

            // Subledger control account (F3 uses this; declared now for the invariant).
            $table->boolean('is_control')->default(false);
            $table->string('control_subledger', 30)->nullable(); // ar | ap | inventory | ...

            $table->char('currency', 3)->default('EGP');
            $table->boolean('is_active')->default(true);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'finance_acct_company_code_unique');
            $table->index(['company_id', 'account_type'], 'finance_acct_company_type_idx');
            $table->index(['company_id', 'is_postable', 'is_active'], 'finance_acct_postable_idx');
            $table->index('parent_id', 'finance_acct_parent_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_accounts');
    }
};
