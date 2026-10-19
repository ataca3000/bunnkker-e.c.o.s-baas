<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ASK-CONFIG-OS-001 — Brand Policy Store.
 *
 * Flexible JSON-blob policy storage per brand + policy_group.
 * One row per brand+group combination. Each update bumps version.
 * Covers: preparation, pricing, inventory, manufacturing, order,
 *         logistics, crm, marketing, ai, workflow, notification,
 *         integration, security, numbering, approval.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('config_brand_policies')) {
            return;
        }

        Schema::create('config_brand_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('brand_id')->constrained('brands')->cascadeOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->string('policy_group', 50);
            $table->json('settings');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->unique(['brand_id', 'policy_group'], 'uq_cbp_brand_group');
            $table->index(['brand_id', 'is_active'], 'idx_cbp_brand_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('config_brand_policies');
    }
};
