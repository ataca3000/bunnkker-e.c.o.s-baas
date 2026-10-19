<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H4. Employee incidents.
 *
 * The operational record of things that happened around a person: a reward, a
 * penalty, a customer complaint or compliment, damaged or missing stock, a
 * warning, a note. Each one names the module and document it came from by opaque
 * reference, so the incident points at the evidence without copying it.
 *
 * An incident may be the origin of a deduction or a bonus; those links are kept
 * so a payslip line can be traced back to the event that caused it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_employee_incidents')) {
            return;
        }

        Schema::create('hr_employee_incidents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

            $table->date('occurred_on');
            // reward | penalty | customer_complaint | customer_appreciation
            // | inventory_damage | inventory_shortage | warning | operational_note
            $table->string('category', 40);
            $table->string('severity', 20)->default('info');   // info | minor | major | critical
            $table->text('description');

            // Reference-only link to the originating module and document.
            $table->string('related_module', 40)->nullable();
            $table->string('related_reference', 64)->nullable();
            $table->string('related_document_type', 60)->nullable();

            $table->decimal('amount', 20, 2)->nullable();       // when the incident carries a value
            $table->uuid('deduction_id')->nullable();           // when it became a deduction
            $table->uuid('bonus_id')->nullable();               // when it became a bonus

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id', 'occurred_on'], 'hr_incident_employee_idx');
            $table->index(['company_id', 'category'], 'hr_incident_category_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employee_incidents');
    }
};
