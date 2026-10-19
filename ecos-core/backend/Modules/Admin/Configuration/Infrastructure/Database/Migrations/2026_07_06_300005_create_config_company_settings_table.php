<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ASK-CONFIG-OS-001 — Company-level Settings.
 *
 * Key-value store for company-wide settings.
 * Groups: general, currency, localization, numbering, security, defaults
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('config_company_settings')) {
            return;
        }

        Schema::create('config_company_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('setting_group', 50)->default('general');
            $table->string('setting_key', 100);
            $table->json('setting_value')->nullable();
            $table->string('description', 255)->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'setting_key'], 'uq_ccs_company_key');
            $table->index(['company_id', 'setting_group'], 'idx_ccs_company_group');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('config_company_settings');
    }
};
