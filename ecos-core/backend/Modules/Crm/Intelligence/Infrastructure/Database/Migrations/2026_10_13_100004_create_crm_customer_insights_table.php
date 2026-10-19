<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Intelligence — EPIC C5. Customer insights.
 *
 * Deterministic observations about a customer (or the portfolio) — "high-value
 * customer at risk", "new customer, first purchase", "churn risk rising". Each
 * carries the metric that triggered it and the rule key, so the insight is
 * explainable and can be regenerated from the same facts.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_insights')) {
            return;
        }

        Schema::create('crm_customer_insights', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->nullable()->constrained('customers')->cascadeOnDelete();

            $table->string('type', 60);
            $table->string('severity', 20)->default('info');   // info | positive | warning | critical
            $table->string('rule_key', 60);
            $table->string('title', 160);
            $table->string('detail', 400)->nullable();
            $table->string('metric_key', 60)->nullable();
            $table->decimal('metric_value', 20, 4)->nullable();
            $table->timestamp('generated_at');
            $table->timestamps();

            $table->index(['company_id', 'customer_id'], 'crm_insight_customer_idx');
            $table->index(['company_id', 'severity'], 'crm_insight_severity_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_insights');
    }
};
