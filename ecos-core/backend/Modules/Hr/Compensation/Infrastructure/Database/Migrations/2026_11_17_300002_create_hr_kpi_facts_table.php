<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3 + H4. Operational KPI facts.
 *
 * ┌─ ONE FACT STREAM · TWO CONSUMERS · ZERO COUPLING ───────────────────────┐
 * │ Commission and performance both need the same thing: what an employee     │
 * │ actually did, measured by an operational module. Rather than HR reaching   │
 * │ into Commerce, Shipping, Inventory or the CRM — which it must never do —   │
 * │ those modules PUSH a flat, self-describing fact here: a metric key, a       │
 * │ value, when it happened, and an opaque reference back to the document.     │
 * │                                                                            │
 * │ Append-only and idempotent on the idempotency key, so an event delivered   │
 * │ twice is counted once and the whole stream is safely replayable. Every      │
 * │ commission figure and every KPI is derived from these rows and nothing     │
 * │ else, which is what makes both of them reproducible.                       │
 * │                                                                            │
 * │ `dimension_key` / `dimension_value` carry an optional scope — a customer,  │
 * │ a product, a channel — so a commission rule can be narrowed to them        │
 * │ without a schema change.                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_kpi_facts')) {
            return;
        }

        Schema::create('hr_kpi_facts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->nullable()->constrained('hr_employees')->cascadeOnDelete();
            $table->foreignUuid('department_id')->nullable()->constrained('hr_departments')->nullOnDelete();

            $table->string('source_module', 40);          // commerce | shipping | inventory | crm | preparation | packing
            $table->string('metric_key', 60);             // commerce.sales_amount, shipping.delivered_shipments, …
            $table->decimal('value', 20, 4)->default(0);  // the measured amount
            $table->decimal('quantity', 20, 4)->default(1); // countable unit (orders, shipments, tickets)

            $table->string('dimension_key', 40)->nullable();    // customer | product | channel | warehouse
            $table->string('dimension_value', 64)->nullable();  // opaque id of that dimension

            $table->timestamp('occurred_at');
            $table->string('source_reference', 64)->nullable();   // opaque operational document id
            $table->string('idempotency_key', 160);
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Delivered twice, counted once.
            $table->unique('idempotency_key', 'hr_kpi_fact_idempotency_unique');
            $table->index(['company_id', 'employee_id', 'metric_key', 'occurred_at'], 'hr_kpi_fact_employee_idx');
            $table->index(['company_id', 'department_id', 'metric_key', 'occurred_at'], 'hr_kpi_fact_department_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_kpi_facts');
    }
};
