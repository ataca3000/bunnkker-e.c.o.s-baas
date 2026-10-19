<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Resolution library.
 *
 * Reusable, canned resolutions an agent applies to a case — a proven answer for
 * a recurring problem. Applying one records a public note and bumps its usage,
 * so the most effective resolutions surface.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_resolution_templates')) {
            return;
        }

        Schema::create('crm_resolution_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('title', 200);
            $table->text('body');
            $table->string('category', 80)->nullable();
            $table->string('applies_to_type', 20)->nullable(); // ticket type it suits
            $table->unsignedInteger('usage_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'applies_to_type'], 'crm_restpl_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_resolution_templates');
    }
};
