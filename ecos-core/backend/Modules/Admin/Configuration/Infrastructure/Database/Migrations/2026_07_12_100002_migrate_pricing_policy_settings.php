<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Migrates existing pricing policy JSON in config_brand_policies:
 *   auto_publish: bool        → publishing_strategy: 'automatic'|'approval_only'
 *   maximum_discount_pct: N   → discount_type: 'percentage' + discount_value: N
 *   price_lock_enabled: bool  → (removed — always enforced at ORM level)
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('config_brand_policies')
            ->where('policy_group', 'pricing')
            ->orderBy('id')
            ->lazyById()
            ->each(function ($row) {
                $settings = json_decode((string) $row->settings, true) ?? [];

                // publishing_strategy (from auto_publish)
                if (! isset($settings['publishing_strategy'])) {
                    $settings['publishing_strategy'] = ($settings['auto_publish'] ?? false)
                        ? 'automatic'
                        : 'approval_only';
                }

                // discount_type + discount_value (from maximum_discount_pct)
                if (! isset($settings['discount_type'])) {
                    $settings['discount_type'] = 'percentage';
                    $settings['discount_value'] = (float) ($settings['maximum_discount_pct'] ?? 15);
                }

                // Remove superseded keys
                unset(
                    $settings['auto_publish'],
                    $settings['price_lock_enabled'],
                    $settings['maximum_discount_pct'],
                );

                DB::table('config_brand_policies')
                    ->where('id', $row->id)
                    ->update(['settings' => json_encode($settings)]);
            });
    }

    public function down(): void
    {
        DB::table('config_brand_policies')
            ->where('policy_group', 'pricing')
            ->orderBy('id')
            ->lazyById()
            ->each(function ($row) {
                $settings = json_decode((string) $row->settings, true) ?? [];

                // Restore auto_publish from publishing_strategy
                if (! isset($settings['auto_publish'])) {
                    $settings['auto_publish'] = ($settings['publishing_strategy'] ?? 'approval_only') === 'automatic';
                }

                // Restore maximum_discount_pct from discount_value (percentage only)
                if (! isset($settings['maximum_discount_pct'])) {
                    $settings['maximum_discount_pct'] = (float) ($settings['discount_value'] ?? 15);
                }

                // Restore price_lock_enabled as false (was always false)
                $settings['price_lock_enabled'] = false;

                unset(
                    $settings['publishing_strategy'],
                    $settings['discount_type'],
                    $settings['discount_value'],
                );

                DB::table('config_brand_policies')
                    ->where('id', $row->id)
                    ->update(['settings' => json_encode($settings)]);
            });
    }
};
