<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Extend the status CHECK constraint to include the three new lifecycle states.
        DB::statement('ALTER TABLE preparation_sessions DROP CHECK chk_preparation_sessions_status');
        DB::statement(
            'ALTER TABLE preparation_sessions ADD CONSTRAINT chk_preparation_sessions_status '
            ."CHECK (status IN ('draft','planning','in_progress','paused','completed','approved','closed','cancelled'))",
        );

        // 2. Add the six new lifecycle timestamp/actor columns (nullable, additive).
        if (Schema::hasColumn('preparation_sessions', 'planned_at')) {
            return;
        }

        Schema::table('preparation_sessions', function (Blueprint $table): void {
            $table->timestampTz('planned_at')->nullable()->after('started_by');
            $table->uuid('planned_by')->nullable()->after('planned_at');
            $table->timestampTz('approved_at')->nullable()->after('completed_by');
            $table->uuid('approved_by')->nullable()->after('approved_at');
            $table->timestampTz('closed_at')->nullable()->after('approved_by');
            $table->uuid('closed_by')->nullable()->after('closed_at');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('preparation_sessions', 'planned_at')) {
            return;
        }

        Schema::table('preparation_sessions', function (Blueprint $table): void {
            $table->dropColumn(['planned_at', 'planned_by', 'approved_at', 'approved_by', 'closed_at', 'closed_by']);
        });

        DB::statement('ALTER TABLE preparation_sessions DROP CHECK chk_preparation_sessions_status');
        DB::statement(
            'ALTER TABLE preparation_sessions ADD CONSTRAINT chk_preparation_sessions_status '
            ."CHECK (status IN ('draft','in_progress','paused','completed','cancelled'))",
        );
    }
};
