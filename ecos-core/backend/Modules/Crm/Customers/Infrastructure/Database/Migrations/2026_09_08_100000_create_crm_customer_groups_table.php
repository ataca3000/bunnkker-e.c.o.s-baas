<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Customer groups.
 *
 * ┌─ ADDITIVE · BUILDS ON THE EXISTING CUSTOMER MASTER ─────────────────────┐
 * │ The single source of truth for customer identity is the existing         │
 * │ `customers` table. This Epic enriches it — it never duplicates it. Groups │
 * │ are a new classification a customer belongs to (retail / wholesale / VIP  │
 * │ …), keyed to the customer by an additive column added later.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_groups')) {
            return;
        }

        Schema::create('crm_customer_groups', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name', 120);
            $table->string('description', 500)->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['company_id', 'name'], 'crm_cgroup_company_name_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_groups');
    }
};
