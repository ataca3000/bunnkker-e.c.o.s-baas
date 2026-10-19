<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CR-PREP-001 Part 3 — Session Freeze Time.
 *
 * Adds:
 *  - preparation_session_policies.freeze_time  (configurable per-warehouse)
 *  - preparation_sessions.frozen_at
 *  - preparation_sessions.frozen_by
 *
 * Note: The 'frozen' status value is validated by SessionStatus PHP enum.
 * DB-level CHECK constraint on status is not added here to remain
 * compatible with both MySQL and PostgreSQL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('preparation_session_policies', function (Blueprint $table): void {
            if (! Schema::hasColumn('preparation_session_policies', 'freeze_time')) {
                $table->time('freeze_time')->nullable()->after('auto_create_time')
                    ->comment('Time at which the session is frozen (e.g. 14:00:00). Null = no auto-freeze.');
            }
        });

        Schema::table('preparation_sessions', function (Blueprint $table): void {
            if (! Schema::hasColumn('preparation_sessions', 'frozen_at')) {
                $table->timestampTz('frozen_at')->nullable()->after('completed_at');
            }
            if (! Schema::hasColumn('preparation_sessions', 'frozen_by')) {
                $table->string('frozen_by', 36)->nullable()->after('frozen_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('preparation_sessions', function (Blueprint $table): void {
            if (Schema::hasColumn('preparation_sessions', 'frozen_by')) {
                $table->dropColumn('frozen_by');
            }
            if (Schema::hasColumn('preparation_sessions', 'frozen_at')) {
                $table->dropColumn('frozen_at');
            }
        });

        Schema::table('preparation_session_policies', function (Blueprint $table): void {
            if (Schema::hasColumn('preparation_session_policies', 'freeze_time')) {
                $table->dropColumn('freeze_time');
            }
        });
    }
};
