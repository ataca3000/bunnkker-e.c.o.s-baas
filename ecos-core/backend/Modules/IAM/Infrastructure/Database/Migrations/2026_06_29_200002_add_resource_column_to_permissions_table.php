<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-SECURITY-001A: Add `resource` column to `permissions` to support the
 * three-segment hierarchical naming convention: domain.resource.action.
 *
 * Before: products.view      (module=products,  action=view)
 * After:  inventory.products.view  (module=inventory, resource=products, action=view)
 *
 * The `module` column now stores the top-level domain (inventory, sales, crm …).
 * The new `resource` column stores the specific resource within that domain.
 *
 * Existing rows with the old two-segment format are left in place; the seeder
 * removes them during its cleanup pass and re-seeds with the new format.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('permissions', 'resource')) {
            return;
        }

        Schema::table('permissions', function (Blueprint $table): void {
            // Nullable during the transition window; the seeder re-seeds with
            // proper values, after which every row will have a resource value.
            $table->string('resource')->nullable()->after('module');

            $table->index('resource');
            $table->index(['module', 'resource']);
            $table->index(['module', 'resource', 'action']);
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('permissions', 'resource')) {
            return;
        }

        Schema::table('permissions', function (Blueprint $table): void {
            $table->dropIndex(['module', 'resource', 'action']);
            $table->dropIndex(['module', 'resource']);
            $table->dropIndex(['resource']);
            $table->dropColumn('resource');
        });
    }
};
