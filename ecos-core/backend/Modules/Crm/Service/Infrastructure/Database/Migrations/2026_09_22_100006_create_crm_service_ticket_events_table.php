<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Ticket events (append-only audit).
 *
 * Every meaningful change to a case — created, status change, assignment,
 * escalation, SLA breach, resolved, reopened — is one immutable row. It is the
 * case's own timeline and the audit trail behind the resolution workflow.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_service_ticket_events')) {
            return;
        }

        Schema::create('crm_service_ticket_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('ticket_id')->constrained('crm_service_tickets')->cascadeOnDelete();
            $table->string('event_type', 40);   // created | status_changed | assigned | escalated | sla_breach | resolved | reopened
            $table->string('from_value', 120)->nullable();
            $table->string('to_value', 120)->nullable();
            $table->string('note', 500)->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['ticket_id', 'occurred_at'], 'crm_tevent_ticket_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_service_ticket_events');
    }
};
