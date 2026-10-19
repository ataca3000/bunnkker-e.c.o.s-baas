<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-IAM-002 Phase 1 — Permission Groups foundation (ADR-038, Part 3).
 *
 * Additive: creates a NEW table only. Touches no existing table and no existing
 * data, so it cannot change any authorization behaviour. The fourteen canonical
 * groups are defined in Modules\IAM\Domain\Enums\PermissionGroup and seeded from
 * there in a later phase — this migration is schema only.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('permission_groups')) {
            return;
        }

        Schema::create('permission_groups', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code')->unique();          // machine code e.g. "inventory"
            $table->string('name');                    // display name e.g. "Inventory"
            $table->string('icon')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_groups');
    }
};
