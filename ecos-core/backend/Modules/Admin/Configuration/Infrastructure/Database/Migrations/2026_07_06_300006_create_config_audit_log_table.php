<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ASK-CONFIG-OS-001 — Configuration Audit Log.
 *
 * Every configuration change (policy update, setting change, geography edit,
 * shipping rule change, delivery window change) is recorded here.
 * Immutable — no soft deletes, no updates.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('config_audit_log')) {
            return;
        }

        Schema::create('config_audit_log', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('brand_id')->nullable()->index();
            $table->string('module', 80)->comment('e.g. delivery_geography, brand_policy, company_setting');
            $table->string('category', 80)->comment('e.g. preparation, pricing, delivery_window');
            $table->string('config_key', 150)->nullable();
            $table->json('old_value')->nullable();
            $table->json('new_value')->nullable();
            $table->string('action', 30)->default('update')->comment('create, update, delete');
            $table->uuid('actor_id')->nullable();
            $table->string('actor_name', 200)->nullable();
            $table->text('reason')->nullable();
            $table->boolean('requires_approval')->default(false);
            $table->string('approval_status', 30)->nullable();
            $table->uuid('approved_by')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->timestampTz('occurred_at');

            $table->index(['company_id', 'occurred_at'], 'idx_cal_company_time');
            $table->index(['brand_id', 'occurred_at'], 'idx_cal_brand_time');
            $table->index(['module', 'category'], 'idx_cal_module_cat');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('config_audit_log');
    }
};
