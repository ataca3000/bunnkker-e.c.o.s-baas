<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F4. Period-closing governance log (append-only).
 *
 * The F1 fiscal period remains the posting gate and the source of truth for a
 * period's status. This table is the GOVERNANCE record layered on top: who soft-
 * closed, hard-closed or reopened a period, when and why. It never changes the
 * ledger and never redefines the F1 lifecycle — it records the decisions taken
 * against it, so a reopen is always accountable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_period_closures', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('fiscal_period_id')->constrained('finance_fiscal_periods')->cascadeOnDelete();

            // soft_close | hard_close | reopen
            $table->string('action', 20);
            $table->string('close_type', 10)->nullable(); // soft | hard
            $table->string('from_status', 20);
            $table->string('to_status', 20);
            $table->string('reason', 500)->nullable();

            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'fiscal_period_id'], 'finance_pclose_period_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_period_closures');
    }
};
