<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_financial_snapshots', 'previous_snapshot_id')) {
            return;
        }

        Schema::table('order_financial_snapshots', function (Blueprint $table) {
            // PART 2 — Snapshot versioning chain
            $table->uuid('previous_snapshot_id')->nullable()->after('snapshot_version');

            // PART 3 — Engine metadata (forensic audit trail)
            $table->string('recipe_version', 20)->nullable()->after('cost_engine_version');
            $table->string('brand_pricing_policy_version', 20)->nullable()->after('recipe_version');
            $table->string('shipping_pricing_version', 20)->nullable()->after('brand_pricing_policy_version');

            // PART 6 — Shipping snapshot detail
            $table->string('shipping_rule_name')->nullable()->after('shipping_rule_id');
            $table->string('shipping_zone')->nullable()->after('shipping_rule_name');
            $table->boolean('shipping_override_applied')->default(false)->after('shipping_zone');
            $table->uuid('shipping_override_by')->nullable()->after('shipping_override_applied');

            // PART 5 — Cost breakdown at order level
            $table->decimal('total_cogs', 12, 4)->nullable()->after('grand_total');
            $table->decimal('gross_profit', 12, 4)->nullable()->after('total_cogs');
            $table->decimal('total_raw_material_cost', 12, 4)->nullable()->after('gross_profit');
            $table->decimal('total_packaging_cost', 12, 4)->nullable()->after('total_raw_material_cost');
            $table->decimal('total_manufacturing_cost', 12, 4)->nullable()->after('total_packaging_cost');
            $table->decimal('total_other_cost', 12, 4)->nullable()->after('total_manufacturing_cost');

            // PART 7 — Margin diagnostics
            $table->decimal('target_margin_percent', 8, 4)->nullable()->after('total_other_cost');
            $table->decimal('actual_margin_percent', 8, 4)->nullable()->after('target_margin_percent');
            $table->decimal('margin_difference', 8, 4)->nullable()->after('actual_margin_percent');
            // 'within_target' | 'below_target' | 'above_target'
            $table->string('margin_status')->nullable()->after('margin_difference');

            // PART 9 — Integrity (SHA-256 of order + line financial data)
            $table->string('integrity_hash', 64)->nullable()->after('margin_status');

            // PART 10 — Explicit immutability markers
            $table->boolean('locked')->default(true)->after('integrity_hash');
            $table->timestamp('locked_at')->nullable()->after('locked');
        });
    }

    public function down(): void
    {
        Schema::table('order_financial_snapshots', function (Blueprint $table) {
            $table->dropColumn([
                'previous_snapshot_id',
                'recipe_version',
                'brand_pricing_policy_version',
                'shipping_pricing_version',
                'shipping_rule_name',
                'shipping_zone',
                'shipping_override_applied',
                'shipping_override_by',
                'total_cogs',
                'gross_profit',
                'total_raw_material_cost',
                'total_packaging_cost',
                'total_manufacturing_cost',
                'total_other_cost',
                'target_margin_percent',
                'actual_margin_percent',
                'margin_difference',
                'margin_status',
                'integrity_hash',
                'locked',
                'locked_at',
            ]);
        });
    }
};
