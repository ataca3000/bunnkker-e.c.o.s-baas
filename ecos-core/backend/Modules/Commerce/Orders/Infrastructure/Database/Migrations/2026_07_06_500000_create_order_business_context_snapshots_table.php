<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-ORDER-006C — Business Context Snapshot
 *
 * Immutable record of the commercial intent behind a confirmed order.
 * Created once at the same moment as the financial snapshot (confirm_order status).
 * Three layers per order: Business Context (WHY) → Financial Snapshot (WHAT) → Operational Execution (HOW).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_business_context_snapshots')) {
            return;
        }

        Schema::create('order_business_context_snapshots', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('order_id')->unique();

            // ── PART 1: Business Policy Versions ──────────────────────────────
            $table->string('brand_policy_version')->nullable();
            $table->string('pricing_policy_version')->nullable();
            $table->string('discount_policy_version')->nullable();
            $table->string('shipping_policy_version')->nullable();
            $table->string('delivery_sla_version')->nullable();
            $table->string('sales_channel_config_version')->nullable();
            $table->string('loyalty_policy_version')->nullable();
            $table->string('promotion_engine_version')->nullable();

            // ── PART 2: Decision Provenance — Price ───────────────────────────
            $table->string('price_source')->nullable();
            $table->string('pricing_engine_rule')->nullable();
            $table->uuid('price_review_id')->nullable();

            // ── PART 2: Decision Provenance — Discount ────────────────────────
            $table->string('discount_source')->nullable();
            $table->uuid('campaign_id')->nullable();
            $table->boolean('discount_manual_override')->default(false);

            // ── PART 2: Decision Provenance — Shipping ────────────────────────
            $table->uuid('shipping_rule_id')->nullable();
            $table->string('shipping_zone')->nullable();

            // ── PART 2: Decision Provenance — Cost ───────────────────────────
            $table->string('cost_source')->nullable();
            $table->string('recipe_version')->nullable();
            $table->string('cost_engine_version')->nullable();

            // ── PART 3: Approval Snapshot ─────────────────────────────────────
            $table->uuid('approved_by')->nullable();
            $table->uuid('confirmation_user')->nullable();
            $table->timestamp('confirmation_time')->nullable();
            $table->string('approval_workflow_version')->nullable();

            // ── PART 4: Customer Commercial Context ───────────────────────────
            $table->string('customer_tier')->nullable();
            $table->string('customer_segment')->nullable();
            $table->string('loyalty_level')->nullable();
            $table->decimal('delivery_success_rate', 5, 2)->nullable();

            // ── PART 5: Brand Context ─────────────────────────────────────────
            $table->string('brand_name')->nullable();
            $table->string('brand_version')->nullable();
            $table->string('brand_commercial_strategy_version')->nullable();

            // ── PART 6: Channel Context ───────────────────────────────────────
            $table->string('channel_name')->nullable();
            $table->string('channel_type')->nullable();
            $table->string('marketplace_version')->nullable();

            // ── PART 7: Marketing Context (nullable — no campaign module yet) ─
            $table->uuid('marketing_campaign_id')->nullable();
            $table->string('campaign_name')->nullable();
            $table->string('campaign_version')->nullable();
            $table->string('utm_source')->nullable();
            $table->string('utm_medium')->nullable();
            $table->string('utm_campaign')->nullable();

            // ── PART 8: Fulfillment Context ───────────────────────────────────
            $table->string('preparation_strategy')->nullable();
            $table->string('allocation_policy')->nullable();
            $table->string('shipping_priority')->nullable();
            $table->string('sla_policy_version')->nullable();

            // ── Immutability ──────────────────────────────────────────────────
            $table->boolean('locked')->default(true);
            $table->timestamp('locked_at')->nullable();
            $table->uuid('created_by')->nullable();

            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('restrict');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_business_context_snapshots');
    }
};
