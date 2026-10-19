<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * TASK-CONFIG-ORDER-002 — Migrate order policy settings to the new schema.
 *
 * Changes:
 *   default_status             → source_entry_policies.{manual, pos, woocommerce, public_api}
 *   payment_proof_required     → payment_proof_policy.{cash, cod, instapay, bank_transfer, mobile_wallet, credit_card}
 *   (new) auto_reserve_inventory
 *   (new) duplicate_phone_handling
 */
return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('config_brand_policies')
            ->where('policy_group', 'order')
            ->get(['id', 'settings']);

        foreach ($rows as $row) {
            $settings = json_decode($row->settings, true) ?? [];

            // Migrate default_status → source_entry_policies.manual
            $oldStatus = $settings['default_status'] ?? 'in_progress';
            $settings['source_entry_policies'] = [
                'manual' => $oldStatus,
                'pos' => 'completed',
                'woocommerce' => 'preserve',
                'public_api' => 'preserve',
            ];

            // Migrate payment_proof_required: bool → per-method payment_proof_policy
            $proofRequired = (bool) ($settings['payment_proof_required'] ?? false);
            $settings['payment_proof_policy'] = [
                'cash' => 'none',
                'cod' => 'none',
                'instapay' => $proofRequired ? 'required' : 'none',
                'bank_transfer' => $proofRequired ? 'required' : 'none',
                'mobile_wallet' => $proofRequired ? 'required' : 'none',
                'credit_card' => 'optional',
            ];

            // Add new keys (idempotent — skip if already present)
            if (! isset($settings['auto_reserve_inventory'])) {
                $settings['auto_reserve_inventory'] = false;
            }
            if (! isset($settings['duplicate_phone_handling'])) {
                $settings['duplicate_phone_handling'] = 'warning_only';
            }

            // Remove deprecated keys
            unset($settings['default_status'], $settings['payment_proof_required']);

            DB::table('config_brand_policies')
                ->where('id', $row->id)
                ->update(['settings' => json_encode($settings), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        $rows = DB::table('config_brand_policies')
            ->where('policy_group', 'order')
            ->get(['id', 'settings']);

        foreach ($rows as $row) {
            $settings = json_decode($row->settings, true) ?? [];

            // Restore default_status from source_entry_policies.manual
            $settings['default_status'] = $settings['source_entry_policies']['manual'] ?? 'in_progress';

            // Restore payment_proof_required (true if instapay was 'required')
            $settings['payment_proof_required'] =
                ($settings['payment_proof_policy']['instapay'] ?? 'none') === 'required';

            // Remove new keys
            unset(
                $settings['source_entry_policies'],
                $settings['payment_proof_policy'],
                $settings['auto_reserve_inventory'],
                $settings['duplicate_phone_handling'],
            );

            DB::table('config_brand_policies')
                ->where('id', $row->id)
                ->update(['settings' => json_encode($settings), 'updated_at' => now()]);
        }
    }
};
