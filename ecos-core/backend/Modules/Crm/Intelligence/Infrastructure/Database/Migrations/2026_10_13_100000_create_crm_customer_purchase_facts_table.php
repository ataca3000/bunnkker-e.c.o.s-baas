<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Intelligence — EPIC C5. Purchase facts.
 *
 * ┌─ THE DETERMINISTIC DATA SOURCE · FED BY REFERENCE ──────────────────────┐
 * │ Commerce owns Orders and Finance owns Payments; the CRM never reads them.  │
 * │ Instead a purchase FACT is pushed here by opaque reference — a customer, an │
 * │ order reference, an amount and a timestamp. Every intelligence metric (RFM, │
 * │ CLV, churn, health) is computed from these immutable facts and nothing else,│
 * │ so every result is reproducible and explainable.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_purchase_facts')) {
            return;
        }

        Schema::create('crm_customer_purchase_facts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();

            $table->string('source_reference', 64);   // opaque Commerce order id — never dereferenced
            $table->string('source_type', 40)->default('order');
            $table->string('channel', 40)->nullable();
            $table->decimal('amount', 20, 2)->default(0);
            $table->unsignedInteger('item_count')->default(0);
            $table->timestamp('occurred_at');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'source_reference'], 'crm_pfact_ref_unique');
            $table->index(['company_id', 'customer_id'], 'crm_pfact_customer_idx');
            $table->index(['company_id', 'occurred_at'], 'crm_pfact_occurred_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_purchase_facts');
    }
};
