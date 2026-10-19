<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-INV-FIX-001 PART 4 — Remove photo_path from inventory_count_lines.
 *
 * Photo evidence capture is deferred to Phase 1.1 (PKG-COUNT-002).
 * The column is dropped to prevent half-implemented functionality from shipping.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_count_lines', function (Blueprint $table): void {
            $table->dropColumn('photo_path');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_count_lines', function (Blueprint $table): void {
            $table->string('photo_path')->nullable()->after('notes');
        });
    }
};
