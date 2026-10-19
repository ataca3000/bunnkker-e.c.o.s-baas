<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * TASK-CONFIG-ORDER-002A — Order Policy v2 data migration.
 *
 * Changes applied to existing config_brand_policies rows (policy_group = 'order'):
 *   Phase 2: source_entry_policies.pos 'completed' → 'confirm_order'
 *   Phase 4: duplicate_phone_handling → customer_matching_policy
 *            Values: warning_only → warn_only
 *                    block_creation → block_new_customer
 *                    allow_duplicate → always_create_new
 *                    (anything else / missing) → reuse_existing
 */
return new class extends Migration
{
    /** @var array<string, string> */
    private const VALUE_MAP = [
        'warning_only' => 'warn_only',
        'block_creation' => 'block_new_customer',
        'allow_duplicate' => 'always_create_new',
    ];

    public function up(): void
    {
        $rows = DB::table('config_brand_policies')
            ->where('policy_group', 'order')
            ->get(['id', 'settings']);

        foreach ($rows as $row) {
            $settings = json_decode($row->settings, true) ?? [];

            // Phase 2: POS completed → confirm_order
            if (($settings['source_entry_policies']['pos'] ?? null) === 'completed') {
                $settings['source_entry_policies']['pos'] = 'confirm_order';
            }

            // Phase 4: rename duplicate_phone_handling → customer_matching_policy
            if (array_key_exists('duplicate_phone_handling', $settings) && ! array_key_exists('customer_matching_policy', $settings)) {
                $old = (string) $settings['duplicate_phone_handling'];
                $settings['customer_matching_policy'] = self::VALUE_MAP[$old] ?? 'reuse_existing';
                unset($settings['duplicate_phone_handling']);
            }

            DB::table('config_brand_policies')
                ->where('id', $row->id)
                ->update(['settings' => json_encode($settings), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        /** @var array<string, string> $reverseMap */
        $reverseMap = array_flip(self::VALUE_MAP);

        $rows = DB::table('config_brand_policies')
            ->where('policy_group', 'order')
            ->get(['id', 'settings']);

        foreach ($rows as $row) {
            $settings = json_decode($row->settings, true) ?? [];

            // Revert POS entry status
            if (($settings['source_entry_policies']['pos'] ?? null) === 'confirm_order') {
                $settings['source_entry_policies']['pos'] = 'completed';
            }

            // Revert customer_matching_policy → duplicate_phone_handling
            if (array_key_exists('customer_matching_policy', $settings) && ! array_key_exists('duplicate_phone_handling', $settings)) {
                $new = (string) $settings['customer_matching_policy'];
                $settings['duplicate_phone_handling'] = $reverseMap[$new] ?? 'warning_only';
                unset($settings['customer_matching_policy']);
            }

            DB::table('config_brand_policies')
                ->where('id', $row->id)
                ->update(['settings' => json_encode($settings), 'updated_at' => now()]);
        }
    }
};
