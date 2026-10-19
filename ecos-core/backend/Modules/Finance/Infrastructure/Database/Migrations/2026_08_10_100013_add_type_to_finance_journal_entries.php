<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Journal types (additive).
 *
 * The analytical kind of an entry (manual, reversal, opening, adjustment, and —
 * for F3 — sales/purchase/cash/bank). Distinct from `source` and `status`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance_journal_entries', function (Blueprint $table): void {
            $table->string('journal_type', 20)->default('general')->after('source');
            $table->index(['company_id', 'journal_type'], 'finance_je_type_idx');
        });
    }

    public function down(): void
    {
        Schema::table('finance_journal_entries', function (Blueprint $table): void {
            $table->dropIndex('finance_je_type_idx');
            $table->dropColumn('journal_type');
        });
    }
};
