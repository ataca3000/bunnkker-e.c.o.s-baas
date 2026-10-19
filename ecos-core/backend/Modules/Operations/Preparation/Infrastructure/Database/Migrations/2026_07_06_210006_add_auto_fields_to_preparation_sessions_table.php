<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CR-PREP-001 — Auto-creation metadata on preparation_sessions.
 *
 * Adds:
 *  - auto_created: true when created by the scheduler, false for manually created
 *  - policy_id: FK to preparation_session_policies (null if manually created)
 *  - orders_count: count of orders currently attached to the session
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('preparation_sessions', 'auto_created')) {
            return;
        }

        Schema::table('preparation_sessions', function (Blueprint $table): void {
            $table->boolean('auto_created')->default(false)->after('cancellation_reason');
            $table->uuid('policy_id')->nullable()->after('auto_created');
            $table->integer('orders_count')->default(0)->after('policy_id');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('preparation_sessions', 'auto_created')) {
            return;
        }

        Schema::table('preparation_sessions', function (Blueprint $table): void {
            $table->dropColumn(['auto_created', 'policy_id', 'orders_count']);
        });
    }
};
