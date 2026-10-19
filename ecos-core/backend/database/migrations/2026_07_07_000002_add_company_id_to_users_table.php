<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-PATCH-001 Fix 3 — Add company_id to users for multi-tenant isolation.
 *
 * Nullable: existing users and super-admins have no company affiliation.
 * When company_id is set, repositories scope queries to that company.
 * When null, no company filter is applied (super-admin unrestricted access).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->uuid('company_id')->nullable()->after('email');
            $table->foreign('company_id')->references('id')->on('companies')->nullOnDelete();
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};
