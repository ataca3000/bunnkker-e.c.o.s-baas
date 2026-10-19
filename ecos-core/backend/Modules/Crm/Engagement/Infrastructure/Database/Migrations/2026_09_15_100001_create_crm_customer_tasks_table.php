<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Engagement — EPIC C2. Customer tasks / follow-ups / appointments /
 * meetings.
 *
 * The actionable side of engagement — items with a due date and a lifecycle
 * (open → completed / cancelled). Their creation and completion are also written
 * as append-only activities, so the timeline records them without ever being
 * rewritten.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_tasks')) {
            return;
        }

        Schema::create('crm_customer_tasks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();

            $table->string('task_type', 20)->default('task'); // task | follow_up | appointment | meeting
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('status', 12)->default('open');    // open | completed | cancelled
            $table->string('priority', 10)->default('normal'); // low | normal | high
            $table->timestamp('due_at')->nullable();
            $table->timestamp('scheduled_at')->nullable();      // appointments / meetings
            $table->string('location', 200)->nullable();

            $table->unsignedBigInteger('assignee_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedBigInteger('completed_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'customer_id', 'status'], 'crm_task_customer_idx');
            $table->index(['assignee_id', 'status', 'due_at'], 'crm_task_assignee_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_tasks');
    }
};
