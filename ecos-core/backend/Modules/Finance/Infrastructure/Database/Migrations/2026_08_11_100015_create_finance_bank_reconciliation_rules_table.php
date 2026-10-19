<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Bank reconciliation rules.
 *
 * Declarative auto-matching rules. When a statement line is imported the engine
 * tries each active rule in priority order; the first whose predicate matches
 * proposes the book counterpart. Manual reconciliation ignores rules entirely.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_bank_reconciliation_rules', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('bank_account_id')->nullable()
                ->constrained('finance_bank_accounts')->cascadeOnDelete();

            $table->string('name', 200);
            $table->integer('priority')->default(100);

            // match_type: contains | equals | regex | amount
            $table->string('match_type', 20)->default('contains');
            $table->string('match_field', 40)->default('description'); // description | external_reference | amount
            $table->string('match_value', 500);

            // What to post the matched line against when auto-cleared.
            $table->foreignId('target_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'priority'], 'finance_brr_active_prio_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_bank_reconciliation_rules');
    }
};
