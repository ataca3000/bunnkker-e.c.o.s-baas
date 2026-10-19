<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Account categories (additive).
 *
 * A finer classification within an account type, for statement grouping. Kept
 * as a nullable column on the account — a classification of the type, not a new
 * axis, and never a posting dimension.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance_accounts', function (Blueprint $table): void {
            $table->string('account_category', 30)->nullable()->after('normal_balance');
            $table->index(['company_id', 'account_category'], 'finance_acct_category_idx');
        });
    }

    public function down(): void
    {
        Schema::table('finance_accounts', function (Blueprint $table): void {
            $table->dropIndex('finance_acct_category_idx');
            $table->dropColumn('account_category');
        });
    }
};
