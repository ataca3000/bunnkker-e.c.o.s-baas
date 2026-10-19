<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Sales activities, reminders and follow-ups.
 *
 * A logged or scheduled touch on a LEAD or an OPPORTUNITY (a lead may not yet be
 * a customer, so these attach to the sales entity, not the customer). Reminders
 * and follow-ups carry a due time and a lifecycle.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_sales_activities')) {
            return;
        }

        Schema::create('crm_sales_activities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->string('subject_type', 20);   // lead | opportunity
            $table->uuid('subject_id');
            $table->string('activity_type', 20);   // call | email | meeting | note | reminder | follow_up
            $table->string('title', 200);
            $table->text('body')->nullable();
            $table->string('status', 12)->default('planned'); // planned | done | cancelled
            $table->timestamp('due_at')->nullable();
            $table->timestamp('remind_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'subject_type', 'subject_id'], 'crm_sactivity_subject_idx');
            $table->index(['assignee_id', 'status', 'due_at'], 'crm_sactivity_due_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_sales_activities');
    }
};
