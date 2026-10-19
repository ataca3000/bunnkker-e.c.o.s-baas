<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widen finance_journal_entries.source_event_id.
 *
 * ┌─ WHY THIS SCHEMA CHANGE IS STRICTLY REQUIRED FOR INTEGRATION ───────────┐
 * │ The bridge builds an idempotency key as `<event_type>:<event_uuid>`. The  │
 * │ longest business event type — manufacturing.production_completion — makes │
 * │ a 72-character key, and the column was varchar(64).                       │
 * │                                                                          │
 * │ The failure mode is the dangerous kind: MySQL raises 1406 on INSERT, the  │
 * │ posting is caught and dead-lettered, and the operational transaction      │
 * │ carries on unaffected. Nothing surfaces except a growing dead-letter       │
 * │ queue, so entire event families would silently never reach the ledger      │
 * │ while everything looked healthy. Found by an end-to-end payroll test.      │
 * │                                                                          │
 * │ 128 leaves headroom for longer event names without another migration.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Widening only — no data can be lost, and every existing row stays valid.
 */
return new class extends Migration
{
    /**
     * Every table that stores the key, at ONE width.
     *
     * They were 128 / 80 / 64 / 80 — so a key could be written to the journal
     * and then fail on the receipt, which is the worst combination: the posting
     * succeeds and the idempotency record does not.
     */
    private const COLUMNS = [
        'finance_journal_entries' => 'source_event_id',
        'finance_posting_audit' => 'source_event_id',
        'finance_posted_event_receipts' => 'source_event_id',
        'finance_posting_dead_letters' => 'source_event_id',
    ];

    public function up(): void
    {
        foreach (self::COLUMNS as $table => $column) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) use ($column): void {
                $t->string($column, 128)->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        // Deliberately not narrowed: shrinking a column that may now hold longer
        // keys would truncate real data.
    }
};
