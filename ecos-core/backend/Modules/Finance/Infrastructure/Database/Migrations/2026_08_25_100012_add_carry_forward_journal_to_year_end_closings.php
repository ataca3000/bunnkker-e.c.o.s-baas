<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Carry-forward journal on year-end closing.
 *
 * "Closing the books": the balance-sheet accounts are zeroed at year end (the
 * carry-forward journal) and reinstated as next year's opening entry. The pair
 * keeps the continuous ledger's cumulative balances correct — the opening entry
 * does not double-count the carried balance. Additive; no existing column
 * changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance_year_end_closings', function (Blueprint $table): void {
            $table->foreignId('carry_forward_journal_id')->nullable()->after('pnl_closing_journal_id')
                ->constrained('finance_journal_entries')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('finance_year_end_closings', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('carry_forward_journal_id');
        });
    }
};
