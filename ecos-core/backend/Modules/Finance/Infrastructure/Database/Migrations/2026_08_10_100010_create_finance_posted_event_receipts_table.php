<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Posted-event receipts (idempotency).
 *
 * ┌─ EXACTLY-ONCE POSTING ──────────────────────────────────────────────────┐
 * │ One receipt per (source_module, source_event_id). A re-delivered or      │
 * │ replayed event resolves to the existing journal instead of posting a     │
 * │ duplicate — enforced by a unique index, not a read-then-write check.     │
 * │ This is the guarantee that a bursty operational stream (POS, shipping)    │
 * │ can never double-count in the ledger.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_posted_event_receipts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->string('source_module', 40);
            $table->string('source_event_id', 64);
            $table->string('posting_rule_code', 60)->nullable();

            $table->foreignId('journal_entry_id')->constrained('finance_journal_entries')->cascadeOnDelete();

            $table->timestamp('posted_at');
            $table->timestamps();

            // The idempotency invariant.
            $table->unique(['source_module', 'source_event_id'], 'finance_receipt_event_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_posted_event_receipts');
    }
};
