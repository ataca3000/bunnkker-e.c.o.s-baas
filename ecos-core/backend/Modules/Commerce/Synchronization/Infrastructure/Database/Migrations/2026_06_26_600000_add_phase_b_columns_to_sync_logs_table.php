<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase B — Dual Run observability columns for sync_logs.
 *
 * Adds correlation tracking and enriched event metadata so every
 * synchronisation log row can be traced back to the originating
 * domain event without querying the event bus.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('sync_logs', 'correlation_id')) {
            return;
        }

        Schema::table('sync_logs', function (Blueprint $table): void {
            // Correlation ID that ties the domain event → listener → service → job → log.
            $table->string('correlation_id', 36)->nullable()->after('action');

            // Domain event metadata for diagnostics.
            $table->string('event_name', 100)->nullable()->after('correlation_id');
            $table->unsignedSmallInteger('event_version')->nullable()->default(1)->after('event_name');

            // Warehouse that triggered the sync (events are warehouse-scoped).
            $table->string('warehouse_id', 36)->nullable()->after('event_version');

            // Round-trip duration in milliseconds (set by the job on completion).
            $table->unsignedInteger('duration_ms')->nullable()->after('warehouse_id');

            $table->index('correlation_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('sync_logs', 'correlation_id')) {
            return;
        }

        Schema::table('sync_logs', function (Blueprint $table): void {
            $table->dropIndex(['correlation_id']);
            $table->dropColumn(['correlation_id', 'event_name', 'event_version', 'warehouse_id', 'duration_ms']);
        });
    }
};
