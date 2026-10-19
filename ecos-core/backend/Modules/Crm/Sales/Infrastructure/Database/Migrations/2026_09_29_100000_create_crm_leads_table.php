<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Leads.
 *
 * A lead is a prospect the CRM owns. It may not yet be a customer; converting a
 * qualified lead creates or links a customer (C1) and opens an opportunity.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_leads')) {
            return;
        }

        Schema::create('crm_leads', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name', 200);
            $table->string('phone', 40)->nullable();
            $table->string('email', 200)->nullable();
            $table->string('company_name', 200)->nullable();
            $table->string('source', 60)->nullable();       // web | referral | campaign | ...
            $table->string('status', 20)->default('new');
            $table->unsignedInteger('score')->nullable();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->uuid('customer_id')->nullable();         // set on conversion (C1)
            $table->uuid('converted_opportunity_id')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->text('notes')->nullable();
            $table->json('tags')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'crm_lead_status_idx');
            $table->index(['owner_id', 'status'], 'crm_lead_owner_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_leads');
    }
};
