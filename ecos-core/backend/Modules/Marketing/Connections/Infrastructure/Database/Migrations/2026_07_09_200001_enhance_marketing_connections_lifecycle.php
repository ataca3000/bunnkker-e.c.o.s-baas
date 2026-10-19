<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds connector health fields + lifecycle transition timestamps
 * to marketing_connections.
 *
 * Backward compatible — all columns are nullable.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('marketing_connections', 'api_status')) {
            return;
        }

        Schema::table('marketing_connections', function (Blueprint $table): void {
            // Health fields
            $table->string('api_status', 30)->nullable()->after('last_synced_at');         // 'available' | 'unavailable' | 'rate_limited'
            $table->integer('rate_limit_remaining')->nullable()->after('api_status');
            $table->timestamp('rate_limit_reset_at')->nullable()->after('rate_limit_remaining');
            $table->integer('avg_sync_duration_seconds')->nullable()->after('rate_limit_reset_at');
            $table->timestamp('last_successful_sync_at')->nullable()->after('avg_sync_duration_seconds');
            $table->timestamp('last_failed_sync_at')->nullable()->after('last_successful_sync_at');
            $table->integer('error_count')->default(0)->after('last_failed_sync_at');
            $table->integer('retry_queue_size')->default(0)->after('error_count');

            // Lifecycle timestamps
            $table->timestamp('connected_at')->nullable()->after('retry_queue_size');
            $table->timestamp('validated_at')->nullable()->after('connected_at');
            $table->timestamp('archived_at')->nullable()->after('validated_at');

            // Previous state (for transitions)
            $table->string('previous_status', 30)->nullable()->after('archived_at');
        });
    }

    public function down(): void
    {
        Schema::table('marketing_connections', function (Blueprint $table): void {
            $table->dropColumn([
                'api_status', 'rate_limit_remaining', 'rate_limit_reset_at',
                'avg_sync_duration_seconds', 'last_successful_sync_at', 'last_failed_sync_at',
                'error_count', 'retry_queue_size',
                'connected_at', 'validated_at', 'archived_at', 'previous_status',
            ]);
        });
    }
};
