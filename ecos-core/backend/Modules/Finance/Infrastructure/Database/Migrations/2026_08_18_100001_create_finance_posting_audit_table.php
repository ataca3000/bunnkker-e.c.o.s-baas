<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F3. Posting audit & trace.
 *
 * One append-only row per attempt to turn a business event into a journal —
 * whether it posted, was a duplicate, was skipped (no financial impact), or
 * failed. It is the forward index of traceability: from a source module + entity
 * + event straight to the journal it produced, with the rule that shaped it and
 * the actor and moment it happened. Nothing here is ever mutated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_posting_audit', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->string('source_module', 60);
            $table->string('source_entity_type', 80)->nullable();
            $table->string('source_entity_id', 64)->nullable();
            $table->string('event_code', 80);
            $table->string('source_event_id', 80);         // idempotency key
            $table->string('posting_rule_code', 60)->nullable();

            $table->foreignId('journal_entry_id')->nullable()
                ->constrained('finance_journal_entries')->nullOnDelete();

            // posted | duplicate | skipped | failed | previewed
            $table->string('result', 20);
            $table->text('error')->nullable();

            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamp('occurred_at');
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'source_module', 'event_code'], 'finance_paudit_source_idx');
            $table->index(['source_entity_type', 'source_entity_id'], 'finance_paudit_entity_idx');
            $table->index('journal_entry_id', 'finance_paudit_journal_idx');
            $table->index(['result', 'occurred_at'], 'finance_paudit_result_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_posting_audit');
    }
};
