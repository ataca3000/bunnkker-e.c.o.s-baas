<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Escalation rules.
 *
 * When an SLA target is breached (or a ticket sits idle), the escalation engine
 * applies a matching rule: raise the escalation level and reassign to a target
 * team/agent. Rules are advisory configuration the engine reads.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_service_escalation_rules')) {
            return;
        }

        Schema::create('crm_service_escalation_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name', 120);

            // first_response_breach | resolution_breach | idle
            $table->string('trigger', 30);
            $table->string('match_priority', 10)->nullable();
            $table->unsignedInteger('idle_minutes')->nullable(); // for the idle trigger

            $table->unsignedBigInteger('reassign_to_user_id')->nullable();
            $table->uuid('reassign_to_team_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'trigger'], 'crm_erule_trigger_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_service_escalation_rules');
    }
};
