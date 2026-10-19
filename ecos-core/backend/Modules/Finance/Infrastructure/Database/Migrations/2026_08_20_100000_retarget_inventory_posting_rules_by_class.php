<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Point the inventory posting rules at an account chosen by inventory class
 * (TASK-FIN-004A).
 *
 * ┌─ WHY THESE RULES COULD NOT POST ────────────────────────────────────────┐
 * │ Nine rules named a generic 'inventory' role. No such account exists, and │
 * │ deliberately so: the approved policy keeps raw materials, packaging and  │
 * │ finished goods on separate accounts, and 1400 is a non-postable header.  │
 * │ So every one of these rules failed at role resolution and dead-lettered. │
 * │                                                                          │
 * │ A rule cannot name the account, because the rule is written once and the │
 * │ answer differs per movement — a goods receipt can bring in any class. So │
 * │ the leg now defers: it names '@inventory_class', and the class the       │
 * │ publishing module stated on the event picks the role. Finance still      │
 * │ looks nothing up; the answer arrives with the event.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Only the role token changes. Sides, sources, amounts and the set of legs are
 * untouched, so what each rule means is exactly what it meant before — it can
 * now be resolved.
 */
return new class extends Migration
{
    /** The rules whose inventory leg was generic. */
    private const RULE_CODES = [
        'inventory.goods_receipt',
        'inventory.supplier_return',
        'inventory.warehouse_transfer',
        'inventory.adjustment_increase',
        'inventory.adjustment_decrease',
        'inventory.count_gain',
        'inventory.count_loss',
        'inventory.write_off',
        'procurement.purchase_return',
    ];

    private const GENERIC = 'inventory';

    private const BY_CLASS = '@inventory_class';

    public function up(): void
    {
        $this->retarget(self::GENERIC, self::BY_CLASS);
    }

    public function down(): void
    {
        $this->retarget(self::BY_CLASS, self::GENERIC);
    }

    private function retarget(string $from, string $to): void
    {
        $rules = DB::table('finance_posting_rules')
            ->whereIn('code', self::RULE_CODES)
            ->get(['id', 'legs']);

        foreach ($rules as $rule) {
            $legs = json_decode((string) $rule->legs, true);

            if (! is_array($legs)) {
                continue;
            }

            $changed = false;

            foreach ($legs as $i => $leg) {
                if (($leg['role'] ?? null) === $from) {
                    $legs[$i]['role'] = $to;
                    $changed = true;
                }
            }

            if ($changed) {
                DB::table('finance_posting_rules')
                    ->where('id', $rule->id)
                    ->update([
                        'legs' => json_encode($legs),
                        'updated_at' => now(),
                    ]);
            }
        }
    }
};
