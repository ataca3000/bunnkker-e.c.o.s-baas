<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the existing status CHECK constraint and recreate it with the two new Wave Engine states.
        // 'collecting' = accepting orders before preparation starts.
        // 'closed'     = time-based end-of-day closure (distinct from 'completed' which means all items prepared).
        $this->dropConstraint('chk_preparation_waves_status');
        DB::statement("ALTER TABLE preparation_waves ADD CONSTRAINT chk_preparation_waves_status CHECK (status IN ('draft','collecting','planning','shortage_blocked','preparing','completed','cancelled','closed'))");
    }

    public function down(): void
    {
        $this->dropConstraint('chk_preparation_waves_status');
        DB::statement("ALTER TABLE preparation_waves ADD CONSTRAINT chk_preparation_waves_status CHECK (status IN ('draft','planning','shortage_blocked','preparing','completed','cancelled'))");
    }

    private function dropConstraint(string $name): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE preparation_waves DROP CONSTRAINT IF EXISTS {$name}");
        } else {
            try {
                DB::statement("ALTER TABLE preparation_waves DROP CHECK {$name}");
            } catch (Throwable $e) {
                // Constraint does not exist — safe to continue
            }
        }
    }
};
