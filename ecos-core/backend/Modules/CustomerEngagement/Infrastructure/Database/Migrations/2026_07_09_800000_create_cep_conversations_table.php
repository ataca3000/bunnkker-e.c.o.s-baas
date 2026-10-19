<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_conversations')) {
            return;
        }

        Schema::create('cep_conversations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('conversation_uuid')->unique();

            // Provider info
            $table->string('provider');
            $table->string('external_conversation_id')->nullable();

            // Customer linkage
            $table->uuid('customer_id')->nullable()->index();
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();

            // BAE integration — no FK constraint
            $table->uuid('business_dna_id')->nullable();

            // Business context
            $table->uuid('company_id')->nullable();
            $table->uuid('brand_id')->nullable();
            $table->uuid('channel_id')->nullable();
            $table->uuid('initiative_id')->nullable();
            $table->uuid('campaign_id')->nullable();

            // Assignment
            $table->uuid('assigned_team_id')->nullable();
            $table->uuid('assigned_employee_id')->nullable();
            $table->uuid('sla_policy_id')->nullable();

            // Status
            $table->string('status')->default('open');
            $table->string('priority')->default('medium');
            $table->string('source')->nullable();
            $table->string('language')->nullable();
            $table->json('sentiment')->nullable();
            $table->json('tags')->nullable();

            // Counters (denormalized for performance)
            $table->unsignedInteger('messages_count')->default(0);
            $table->unsignedInteger('unread_count')->default(0);
            $table->unsignedInteger('internal_notes_count')->default(0);

            // Timestamps
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamp('last_agent_message_at')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('closed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Indexes (prefix: cep_cv_)
            $table->index(['provider', 'external_conversation_id'], 'cep_cv_provider_ext_idx');
            $table->index(['status', 'company_id'], 'cep_cv_status_co_idx');
            $table->index(['assigned_employee_id', 'status'], 'cep_cv_emp_status_idx');
            $table->index(['assigned_team_id', 'status'], 'cep_cv_team_status_idx');
            $table->index(['business_dna_id'], 'cep_cv_dna_idx');
            $table->index(['campaign_id'], 'cep_cv_camp_idx');
            $table->index(['customer_id'], 'cep_cv_cust_idx');
            $table->index(['company_id', 'created_at'], 'cep_cv_co_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_conversations');
    }
};
