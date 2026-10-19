<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H3. Commission rules.
 *
 * ┌─ CONFIGURED, NEVER CODED ───────────────────────────────────────────────┐
 * │ "2% of sales" and "EGP 15 per delivered shipment" are the same rule with   │
 * │ different settings, not two pieces of code. A rule names the METRIC it     │
 * │ measures, the METHOD it applies, and a rate — so a new commission scheme   │
 * │ is a row, not a deployment.                                               │
 * │                                                                            │
 * │   percentage_of_value  → rate % of the metric's value  (sales commission)  │
 * │   amount_per_unit      → rate × the metric's quantity  (per shipment)      │
 * │   tiered               → the tier table below, by value band              │
 * │                                                                            │
 * │ `applies_to` scopes a rule to one employee, a position, a department or a  │
 * │ job grade. `dimension_*` narrows it further to a customer or product, which │
 * │ is how "by customer" and "by product" work without new columns.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_commission_rules')) {
            Schema::create('hr_commission_rules', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();

                $table->string('code', 40);
                $table->string('name', 150);
                $table->string('description', 400)->nullable();

                // What the rule measures and how it pays.
                $table->string('metric_key', 60);
                $table->string('method', 30);                       // percentage_of_value | amount_per_unit | tiered
                $table->decimal('rate', 12, 4)->default(0);         // percent, or amount per unit

                // Who it applies to.
                $table->string('applies_to', 20)->default('employee');   // employee|position|department|job_grade|all
                $table->uuid('target_id')->nullable();

                // Optional narrowing to a customer, product, channel …
                $table->string('dimension_key', 40)->nullable();
                $table->string('dimension_value', 64)->nullable();

                // Guard rails.
                $table->decimal('min_amount', 20, 2)->nullable();
                $table->decimal('max_amount', 20, 2)->nullable();
                $table->decimal('threshold_value', 20, 4)->nullable();   // metric must reach this before paying

                $table->date('effective_from')->nullable();
                $table->date('effective_to')->nullable();
                $table->unsignedSmallInteger('priority')->default(100);
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['company_id', 'code'], 'hr_commission_rule_code_unique');
                $table->index(['company_id', 'is_active', 'applies_to'], 'hr_commission_rule_scope_idx');
            });
        }

        if (! Schema::hasTable('hr_commission_rule_tiers')) {
            Schema::create('hr_commission_rule_tiers', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('rule_id')->constrained('hr_commission_rules')->cascadeOnDelete();

                $table->decimal('from_value', 20, 4)->default(0);
                $table->decimal('to_value', 20, 4)->nullable();   // null = open-ended top tier
                $table->decimal('rate', 12, 4)->default(0);
                $table->unsignedSmallInteger('sequence')->default(1);
                $table->timestamps();

                $table->index(['rule_id', 'sequence'], 'hr_commission_tier_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_commission_rule_tiers');
        Schema::dropIfExists('hr_commission_rules');
    }
};
