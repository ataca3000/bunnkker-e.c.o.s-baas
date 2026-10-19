<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Intelligence — EPIC C5. The intelligence profile (read model).
 *
 * One deterministic snapshot per customer: RFM, lifetime value, purchase
 * frequency, churn risk, health score, segment and lifecycle stage — each with a
 * stored `explanation` breakdown so every number can be traced to its inputs.
 * Recomputed from the purchase facts; never hand-edited.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_intelligence_profiles')) {
            return;
        }

        Schema::create('crm_customer_intelligence_profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();

            // Raw RFM inputs
            $table->unsignedInteger('recency_days')->nullable();
            $table->unsignedInteger('frequency')->default(0);       // order count
            $table->decimal('monetary', 20, 2)->default(0);         // total spent

            // RFM quintile scores (1..5) + segment
            $table->unsignedTinyInteger('recency_score')->default(0);
            $table->unsignedTinyInteger('frequency_score')->default(0);
            $table->unsignedTinyInteger('monetary_score')->default(0);
            $table->string('rfm_segment', 40)->nullable();

            // Value
            $table->decimal('average_order_value', 20, 2)->default(0);
            $table->decimal('lifetime_value', 20, 2)->default(0);       // historical = total spent
            $table->decimal('predicted_lifetime_value', 20, 2)->default(0);
            $table->decimal('purchase_frequency_monthly', 12, 4)->default(0);
            $table->unsignedInteger('avg_interval_days')->nullable();
            $table->unsignedInteger('tenure_days')->default(0);

            // Risk & health
            $table->unsignedTinyInteger('churn_risk_score')->default(0);   // 0..100
            $table->string('churn_risk_band', 20)->default('low');
            $table->unsignedTinyInteger('health_score')->default(0);       // 0..100
            $table->string('health_band', 20)->default('critical');

            // Classification
            $table->string('segment', 40)->nullable();
            $table->string('lifecycle_stage', 20)->default('new');
            $table->boolean('is_repeat')->default(false);
            $table->boolean('is_retained')->default(false);

            $table->timestamp('first_purchase_at')->nullable();
            $table->timestamp('last_purchase_at')->nullable();
            $table->json('explanation')->nullable();     // full deterministic breakdown
            $table->timestamp('computed_at')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'customer_id'], 'crm_intel_profile_unique');
            $table->index(['company_id', 'rfm_segment'], 'crm_intel_segment_idx');
            $table->index(['company_id', 'churn_risk_band'], 'crm_intel_churn_idx');
            $table->index(['company_id', 'health_band'], 'crm_intel_health_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_intelligence_profiles');
    }
};
