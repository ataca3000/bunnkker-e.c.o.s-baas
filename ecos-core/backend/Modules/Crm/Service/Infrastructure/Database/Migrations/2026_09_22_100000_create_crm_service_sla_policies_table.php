<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. SLA policies.
 *
 * A policy sets the first-response and resolution targets for a priority. A
 * ticket resolves a policy at creation and its clock is derived from these
 * minutes — the SLA is configuration the engine reads, never a stored countdown.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_service_sla_policies')) {
            return;
        }

        Schema::create('crm_service_sla_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name', 120);
            $table->string('priority', 10)->nullable();   // applies to this priority; null = any
            $table->unsignedInteger('first_response_minutes')->default(240);
            $table->unsignedInteger('resolution_minutes')->default(1440);
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'priority'], 'crm_sla_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_service_sla_policies');
    }
};
