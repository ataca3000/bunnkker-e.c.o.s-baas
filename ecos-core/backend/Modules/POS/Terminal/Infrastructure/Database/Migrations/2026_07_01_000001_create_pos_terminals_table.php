<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PKG-POS-003: POS terminals table.
 *
 * Cross-module references (branch_id, warehouse_id) are stored as plain UUIDs
 * without FK constraints — module boundary integrity is enforced at the
 * application layer, not at the DB level.
 *
 * hardware_config uses PostgreSQL JSONB for efficient operator queries
 * (e.g. filtering terminals by printer type). (ADR-POS-001)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_terminals')) {
            return;
        }

        Schema::create('pos_terminals', static function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->string('terminal_code', 50)->unique();
            $table->string('name', 255);

            $table->uuid('branch_id');
            $table->uuid('warehouse_id');

            $table->string('status', 50)->default('inactive');

            $table->json('hardware_config')->nullable();

            $table->timestamp('last_seen_at')->nullable();
            $table->string('last_seen_ip', 45)->nullable();

            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->index('branch_id');
            $table->index('warehouse_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_terminals');
    }
};
