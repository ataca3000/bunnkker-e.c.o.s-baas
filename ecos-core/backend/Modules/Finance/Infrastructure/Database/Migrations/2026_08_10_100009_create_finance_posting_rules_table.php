<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Posting rules.
 *
 * A posting rule is CONFIGURATION that maps a business event type to a balanced
 * set of journal legs (which account each side, how the amount is sourced). It
 * is the Strategy the Posting Engine resolves in F3; F1 builds and tests the
 * mechanism so the operational integrations later plug in without redesign.
 *
 * The rule NEVER writes the ledger — it only describes how a journal should be
 * shaped. The Journal Engine remains the sole GL writer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_posting_rules', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            // Nullable company = a global template rule.
            $table->uuid('company_id')->nullable();

            $table->string('code', 60);
            $table->string('event_type', 80);   // e.g. "sales.order_invoiced"
            $table->string('description', 500)->nullable();

            // [{ side: debit|credit, account_code|account_resolver, amount_source }, ...]
            $table->json('legs');

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'finance_prule_company_code_unique');
            $table->index(['event_type', 'is_active'], 'finance_prule_event_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_posting_rules');
    }
};
