<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Budget control rules (alert & blocking thresholds).
 *
 * A rule sets the consumption thresholds at which the control engine warns or
 * blocks: e.g. warn at 90%, block at 100%. Rules are advisory configuration the
 * engine evaluates read-only; a "block" verdict is returned to the caller — the
 * engine never posts, never mutates a budget or the ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_budget_control_rules', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            // global | account | dimension
            $table->string('scope', 20)->default('global');
            $table->foreignId('account_id')->nullable()->constrained('finance_accounts')->nullOnDelete();
            $table->string('dimension_type', 20)->nullable();
            $table->string('dimension_id', 64)->nullable();

            $table->decimal('warn_threshold_pct', 5, 2)->default(90);
            $table->decimal('block_threshold_pct', 5, 2)->default(100);
            // warn | block | none
            $table->string('action', 10)->default('warn');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'scope'], 'finance_bcrule_scope_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_budget_control_rules');
    }
};
