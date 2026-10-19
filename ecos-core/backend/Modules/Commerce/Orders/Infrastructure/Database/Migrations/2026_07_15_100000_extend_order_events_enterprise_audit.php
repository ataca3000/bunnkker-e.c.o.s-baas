<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ORDER-ENTERPRISE-AUDIT-TIMELINE-001
 * Adds enterprise audit fields to order_events:
 *   actor_type     — 'user' | 'system' | 'api' | 'automation' | 'woocommerce' | 'webhook'
 *   source         — 'dashboard' | 'mobile_app' | 'api' | 'woocommerce' | 'automation' | 'cron' | 'webhook'
 *   action_type    — semantic category for UI grouping / filtering
 *   changed_fields — JSON array of field names that changed
 *   reason         — optional human-readable reason for the action
 *   ip_address     — client IP (IPv4 or IPv6, max 45 chars)
 *   user_agent     — browser / client UA
 *   metadata       — free-form JSON for extra context
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_events', 'actor_type')) {
            return;
        }

        Schema::table('order_events', function (Blueprint $table) {
            $table->string('actor_type', 50)->nullable()->after('actor_name');
            $table->string('source', 100)->nullable()->after('actor_type');
            $table->string('action_type', 50)->nullable()->after('source');
            $table->json('changed_fields')->nullable()->after('action_type');
            $table->string('reason', 500)->nullable()->after('changed_fields');
            $table->string('ip_address', 45)->nullable()->after('reason');
            $table->string('user_agent', 500)->nullable()->after('ip_address');
            $table->json('metadata')->nullable()->after('user_agent');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_events', 'actor_type')) {
            return;
        }

        Schema::table('order_events', function (Blueprint $table) {
            $table->dropColumn([
                'actor_type',
                'source',
                'action_type',
                'changed_fields',
                'reason',
                'ip_address',
                'user_agent',
                'metadata',
            ]);
        });
    }
};
