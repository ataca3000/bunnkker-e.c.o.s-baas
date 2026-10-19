<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Service tickets (the case).
 *
 * ┌─ THE CRM OWNS THE CASE · INTEGRATES BY REFERENCE ONLY ──────────────────┐
 * │ A ticket, complaint, service request, RMA return or warranty case belongs  │
 * │ to a customer (C1). It may REFERENCE an order / product / shipment by       │
 * │ opaque id in `source_reference` — never a foreign key into Finance,        │
 * │ Inventory or Shipping, and never a copy of their data. Those systems own   │
 * │ the actual return/refund; the CRM owns the case that tracks it.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_service_tickets')) {
            return;
        }

        Schema::create('crm_service_tickets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();

            $table->string('ticket_number', 40)->unique();
            $table->string('type', 20)->default('ticket');
            $table->string('subject', 250);
            $table->text('description')->nullable();
            $table->string('status', 15)->default('new');
            $table->string('priority', 10)->default('normal');
            $table->string('channel', 20)->nullable();
            $table->string('category', 60)->nullable();

            $table->foreignUuid('sla_policy_id')->nullable()->constrained('crm_service_sla_policies')->nullOnDelete();
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->uuid('team_id')->nullable();

            $table->timestamp('first_response_due_at')->nullable();
            $table->timestamp('resolution_due_at')->nullable();
            $table->timestamp('first_responded_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->boolean('first_response_breached')->default(false);
            $table->boolean('resolution_breached')->default(false);

            $table->unsignedInteger('reopened_count')->default(0);
            $table->unsignedInteger('escalation_level')->default(0);
            $table->timestamp('escalated_at')->nullable();
            $table->unsignedTinyInteger('satisfaction_rating')->nullable();

            // Reference-only integration with operational systems.
            $table->json('source_reference')->nullable();
            $table->json('tags')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status', 'priority'], 'crm_ticket_status_idx');
            $table->index(['company_id', 'customer_id'], 'crm_ticket_customer_idx');
            $table->index(['assignee_id', 'status'], 'crm_ticket_assignee_idx');
            $table->index('resolution_due_at', 'crm_ticket_res_due_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_service_tickets');
    }
};
