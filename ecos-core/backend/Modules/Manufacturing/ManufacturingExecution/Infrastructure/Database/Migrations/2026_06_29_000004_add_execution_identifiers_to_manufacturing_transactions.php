<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PKG-05B: Extend manufacturing_transactions with execution identifiers.
 *
 * The ManufacturingTransaction is the official execution record consumed by
 * AI, auditing, and future replay. These columns make it self-contained:
 *
 *   decision_key   — content-addressed SHA-256 of (product, warehouse, recipe,
 *                    bom_version, snapshot_hash). Deterministic across plan_ids.
 *                    Enables idempotency checks beyond a single plan lifecycle.
 *
 *   correlation_id — propagated from plan.metadata['correlation_id'] or freshly
 *                    generated. Ties log entries across all services for one
 *                    manufacturing request.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('manufacturing_transactions', 'decision_key')) {
            return;
        }

        Schema::table('manufacturing_transactions', function (Blueprint $table): void {
            $table->string('decision_key', 64)->nullable()->after('execution_id');
            $table->string('correlation_id', 36)->nullable()->after('decision_key');

            $table->index('decision_key');
            $table->index('correlation_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('manufacturing_transactions', 'decision_key')) {
            return;
        }

        Schema::table('manufacturing_transactions', function (Blueprint $table): void {
            $table->dropIndex(['decision_key']);
            $table->dropIndex(['correlation_id']);
            $table->dropColumn(['decision_key', 'correlation_id']);
        });
    }
};
