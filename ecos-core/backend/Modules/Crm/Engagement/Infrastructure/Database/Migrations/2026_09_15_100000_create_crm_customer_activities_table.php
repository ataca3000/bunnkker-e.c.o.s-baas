<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Engagement — EPIC C2. Customer activities (append-only).
 *
 * ┌─ THE APPEND-ONLY INTERACTION LOG THE CRM OWNS ──────────────────────────┐
 * │ Every CRM-logged interaction — a call, an email, a WhatsApp/Messenger      │
 * │ activity captured by an agent, a note, a meeting held — is one immutable    │
 * │ row here. Interactions that live in OTHER systems (the conversation inbox,  │
 * │ orders) are READ into the timeline from those systems and are never copied  │
 * │ into this table. The timeline is append-only; this table is its backbone.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_activities')) {
            return;
        }

        Schema::create('crm_customer_activities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();

            $table->string('activity_type', 20);            // call | email | whatsapp | ...
            $table->string('direction', 12)->default('outbound');
            $table->string('channel', 20)->nullable();
            $table->string('subject', 200)->nullable();
            $table->text('body')->nullable();
            $table->string('outcome', 120)->nullable();
            $table->timestamp('occurred_at');

            // Optional link to a CRM actionable (task/meeting), never to business data.
            $table->string('related_type', 40)->nullable();
            $table->uuid('related_id')->nullable();
            $table->json('metadata')->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'customer_id', 'occurred_at'], 'crm_activity_customer_idx');
            $table->index(['customer_id', 'activity_type'], 'crm_activity_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_activities');
    }
};
