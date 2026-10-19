<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Customer tags (catalog + assignment).
 *
 * A per-company tag catalog and a many-to-many assignment to customers. Free-form
 * labels for segmentation, distinct from the structured group.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('crm_customer_tags')) {
            Schema::create('crm_customer_tags', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->nullable();
                $table->string('name', 80);
                $table->string('color', 20)->nullable();
                $table->timestamps();

                $table->unique(['company_id', 'name'], 'crm_ctag_company_name_unique');
            });
        }

        if (! Schema::hasTable('crm_customer_tag_assignments')) {
            Schema::create('crm_customer_tag_assignments', function (Blueprint $table): void {
                $table->id(); // pivot: auto-increment, populated by the DB on attach
                $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
                $table->foreignUuid('tag_id')->constrained('crm_customer_tags')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['customer_id', 'tag_id'], 'crm_ctag_assign_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_tag_assignments');
        Schema::dropIfExists('crm_customer_tags');
    }
};
