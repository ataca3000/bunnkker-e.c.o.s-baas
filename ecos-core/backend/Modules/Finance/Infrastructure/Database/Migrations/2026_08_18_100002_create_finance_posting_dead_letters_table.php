<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F3. Posting dead-letter queue.
 *
 * A financial event that could not post (missing rule mapping, unmapped account,
 * a transient failure after retries) lands here rather than being lost or
 * silently double-attempted. It carries the full event payload so it can be
 * replayed once the cause is fixed — the idempotency key guarantees the replay
 * cannot double-post. This is the durability guarantee behind an async posting
 * pipeline.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_posting_dead_letters', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->string('source_module', 60);
            $table->string('event_code', 80);
            $table->string('source_entity_type', 80)->nullable();
            $table->string('source_entity_id', 64)->nullable();
            $table->string('source_event_id', 80);

            $table->json('payload');
            $table->text('error')->nullable();
            $table->unsignedInteger('attempts')->default(1);

            // pending | resolved | discarded
            $table->string('status', 20)->default('pending');
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'finance_pdl_status_idx');
            $table->index(['source_module', 'event_code'], 'finance_pdl_source_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_posting_dead_letters');
    }
};
