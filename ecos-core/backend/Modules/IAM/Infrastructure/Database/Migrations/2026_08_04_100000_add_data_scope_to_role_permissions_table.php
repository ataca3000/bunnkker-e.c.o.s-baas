<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-IAM-002 — Data Scope Engine grant columns (ADR-038, Part 3).
 *
 * Additive and defaulted: adds `data_scope` (default 'all') and a nullable
 * `scope_descriptor` JSON to permission grants. Because the default is 'all', every
 * existing grant resolves to an UNRESTRICTED constraint — identical to today. Data
 * scoping only activates when a grant is explicitly narrowed AND a query opts into
 * `scopedTo()`. Stored as a portable string (not a DB enum) to avoid enum-alter churn.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('role_permissions') || Schema::hasColumn('role_permissions', 'data_scope')) {
            return;
        }

        Schema::table('role_permissions', function (Blueprint $table): void {
            $table->string('data_scope', 32)->default('all')->after('conditions'); // self|team|branch|…|all
            $table->json('scope_descriptor')->nullable()->after('data_scope');       // {"column":..,"values":[..]}

            $table->index('data_scope');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('role_permissions') || ! Schema::hasColumn('role_permissions', 'data_scope')) {
            return;
        }

        Schema::table('role_permissions', function (Blueprint $table): void {
            $table->dropIndex(['data_scope']);
            $table->dropColumn(['data_scope', 'scope_descriptor']);
        });
    }
};
