<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Finance OS — EPIC F3. Global posting-rule templates.
 *
 * ┌─ ACCOUNTING AS CONFIGURATION, NOT CODE ─────────────────────────────────┐
 * │ One rule per financially-relevant business event. Each leg names a ROLE   │
 * │ (resolved to a company's account at posting) and an amount SOURCE (read    │
 * │ by name from the event). No account is hardcoded anywhere. A company may   │
 * │ override any template with its own rule; events with no rule here (order   │
 * │ confirmation, reservation, purchase request) have no financial impact.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    /** @return array<string, array<int, array{side:string, role:string, source:string}>> */
    private function rules(): array
    {
        return [
            // ── Inventory (perpetual valuation) ──────────────────────────────────
            'inventory.goods_receipt' => [
                ['side' => 'debit', 'role' => 'inventory', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'grni', 'source' => 'net'],
            ],
            'inventory.supplier_return' => [
                ['side' => 'debit', 'role' => 'grni', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'inventory', 'source' => 'net'],
            ],
            'inventory.warehouse_transfer' => [
                ['side' => 'debit', 'role' => 'inventory_in_transit', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'inventory', 'source' => 'net'],
            ],
            'inventory.adjustment_increase' => [
                ['side' => 'debit', 'role' => 'inventory', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'inventory_adjustment_gain', 'source' => 'net'],
            ],
            'inventory.adjustment_decrease' => [
                ['side' => 'debit', 'role' => 'inventory_adjustment_loss', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'inventory', 'source' => 'net'],
            ],
            'inventory.count_gain' => [
                ['side' => 'debit', 'role' => 'inventory', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'inventory_adjustment_gain', 'source' => 'net'],
            ],
            'inventory.count_loss' => [
                ['side' => 'debit', 'role' => 'inventory_adjustment_loss', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'inventory', 'source' => 'net'],
            ],
            'inventory.write_off' => [
                ['side' => 'debit', 'role' => 'inventory_writeoff_expense', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'inventory', 'source' => 'net'],
            ],

            // ── Procurement (accrual + input VAT + supplier liability) ────────────
            'procurement.purchase_materials' => [
                ['side' => 'debit', 'role' => 'grni', 'source' => 'net'],
                ['side' => 'debit', 'role' => 'vat_input', 'source' => 'tax'],
                ['side' => 'credit', 'role' => 'ap_control', 'source' => 'gross'],
            ],
            'procurement.purchase_return' => [
                ['side' => 'debit', 'role' => 'ap_control', 'source' => 'gross'],
                ['side' => 'credit', 'role' => 'inventory', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'vat_input', 'source' => 'tax'],
            ],

            // ── Manufacturing (WIP) ──────────────────────────────────────────────
            'manufacturing.material_consumption' => [
                ['side' => 'debit', 'role' => 'wip', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'raw_materials', 'source' => 'cost'],
            ],
            'manufacturing.bom_consumption' => [
                ['side' => 'debit', 'role' => 'wip', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'raw_materials', 'source' => 'cost'],
            ],
            'manufacturing.production_completion' => [
                ['side' => 'debit', 'role' => 'finished_goods', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'wip', 'source' => 'cost'],
            ],
            'manufacturing.scrap' => [
                ['side' => 'debit', 'role' => 'scrap_expense', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'wip', 'source' => 'cost'],
            ],
            'manufacturing.rework' => [
                ['side' => 'debit', 'role' => 'wip', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'raw_materials', 'source' => 'cost'],
            ],

            // ── POS ──────────────────────────────────────────────────────────────
            'pos.sale' => [
                ['side' => 'debit', 'role' => 'cash', 'source' => 'gross'],
                ['side' => 'credit', 'role' => 'sales_revenue', 'source' => 'net'],
                ['side' => 'credit', 'role' => 'vat_output', 'source' => 'tax'],
            ],
            'pos.return' => [
                ['side' => 'debit', 'role' => 'sales_returns', 'source' => 'net'],
                ['side' => 'debit', 'role' => 'vat_output', 'source' => 'tax'],
                ['side' => 'credit', 'role' => 'cash', 'source' => 'gross'],
            ],
            'pos.discount' => [
                ['side' => 'debit', 'role' => 'sales_discount', 'source' => 'amount'],
                ['side' => 'credit', 'role' => 'cash', 'source' => 'amount'],
            ],
            'pos.refund' => [
                ['side' => 'debit', 'role' => 'refund_clearing', 'source' => 'gross'],
                ['side' => 'credit', 'role' => 'cash', 'source' => 'gross'],
            ],
            'pos.cash_drawer' => [
                ['side' => 'debit', 'role' => 'cash', 'source' => 'amount'],
                ['side' => 'credit', 'role' => 'pos_clearing', 'source' => 'amount'],
            ],

            // ── Shipping ─────────────────────────────────────────────────────────
            'shipping.shipment_cost' => [
                ['side' => 'debit', 'role' => 'shipping_expense', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'carrier_payable', 'source' => 'cost'],
            ],
            'shipping.delivery_failure' => [
                ['side' => 'debit', 'role' => 'shipping_expense', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'carrier_payable', 'source' => 'cost'],
            ],
            'shipping.return_shipment' => [
                ['side' => 'debit', 'role' => 'shipping_expense', 'source' => 'cost'],
                ['side' => 'credit', 'role' => 'carrier_payable', 'source' => 'cost'],
            ],

            // ── CRM & Marketing ──────────────────────────────────────────────────
            'crm.coupon_redemption' => [
                ['side' => 'debit', 'role' => 'coupon_expense', 'source' => 'amount'],
                ['side' => 'credit', 'role' => 'ar_control', 'source' => 'amount'],
            ],
            'crm.marketing_credit' => [
                ['side' => 'debit', 'role' => 'marketing_credit_expense', 'source' => 'amount'],
                ['side' => 'credit', 'role' => 'ar_control', 'source' => 'amount'],
            ],
            'crm.loyalty_earn' => [
                ['side' => 'debit', 'role' => 'loyalty_expense', 'source' => 'amount'],
                ['side' => 'credit', 'role' => 'loyalty_liability', 'source' => 'amount'],
            ],
            'crm.loyalty_redeem' => [
                ['side' => 'debit', 'role' => 'loyalty_liability', 'source' => 'amount'],
                ['side' => 'credit', 'role' => 'sales_revenue', 'source' => 'amount'],
            ],
        ];
    }

    public function up(): void
    {
        if (! Schema::hasTable('finance_posting_rules')) {
            return;
        }

        foreach ($this->rules() as $code => $legs) {
            $exists = DB::table('finance_posting_rules')
                ->where('code', $code)
                ->whereNull('company_id')
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('finance_posting_rules')->insert([
                'uuid' => (string) Str::uuid(),
                'company_id' => null,
                'code' => $code,
                'event_type' => $code,
                'description' => 'F3 global template — '.$code,
                'legs' => json_encode($legs),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('finance_posting_rules')) {
            return;
        }

        DB::table('finance_posting_rules')
            ->whereNull('company_id')
            ->whereIn('code', array_keys($this->rules()))
            ->delete();
    }
};
