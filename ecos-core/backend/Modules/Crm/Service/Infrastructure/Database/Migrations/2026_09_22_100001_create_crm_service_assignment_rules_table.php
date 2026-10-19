<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Assignment rules.
 *
 * The assignment engine matches a ticket (by type / category / channel /
 * priority) to a rule and routes it to an agent or a team — directly or
 * round-robin within a team. Rules are tried in priority order; the first match
 * wins.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_service_assignment_rules')) {
            return;
        }

        Schema::create('crm_service_assignment_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('name', 120);
            $table->integer('order')->default(100);

            // Match predicate (any null = wildcard).
            $table->string('match_type', 20)->nullable();
            $table->string('match_category', 60)->nullable();
            $table->string('match_channel', 20)->nullable();
            $table->string('match_priority', 10)->nullable();

            // Target.
            $table->string('strategy', 20)->default('direct'); // direct | round_robin
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->uuid('team_id')->nullable();
            $table->json('team_member_ids')->nullable();        // round-robin pool

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'order'], 'crm_arule_order_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_service_assignment_rules');
    }
};
