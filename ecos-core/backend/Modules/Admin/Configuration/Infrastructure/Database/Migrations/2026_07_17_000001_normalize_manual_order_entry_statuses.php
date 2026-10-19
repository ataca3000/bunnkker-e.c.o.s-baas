<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * TASK-ORDER-ENTRY-STATUS-WORKFLOW-001 — Normalize manual order entry statuses.
 *
 * Both existing brands stored source_entry_policies.manual as the legacy string
 * "in_progress", which is not a valid OrderStatus enum value and produced only
 * one (invalid) option in the Entry Status dropdown.
 *
 * This migration:
 *   1. Converts any string value → array
 *   2. Replaces single-element or invalid-status arrays with the full default set
 *   3. Preserves brands that already have a multi-element valid array
 */
return new class extends Migration
{
    private const VALID_ENTRY_STATUSES = [
        'pending',
        'awaiting_payment',
        'processing',
        'confirmed',
    ];

    public function up(): void
    {
        DB::table('config_brand_policies')
            ->where('policy_group', 'order')
            ->get(['id', 'settings'])
            ->each(function (object $row): void {
                $settings = json_decode($row->settings, true) ?? [];
                $manual = $settings['source_entry_policies']['manual'] ?? null;

                // Already a multi-element array — nothing to do.
                if (is_array($manual) && count($manual) > 1) {
                    return;
                }

                // String or single-element array → expand to full default set.
                $settings['source_entry_policies']['manual'] = self::VALID_ENTRY_STATUSES;

                DB::table('config_brand_policies')
                    ->where('id', $row->id)
                    ->update([
                        'settings' => json_encode($settings),
                        'updated_at' => now(),
                    ]);
            });
    }

    public function down(): void
    {
        DB::table('config_brand_policies')
            ->where('policy_group', 'order')
            ->get(['id', 'settings'])
            ->each(function (object $row): void {
                $settings = json_decode($row->settings, true) ?? [];

                // Revert to legacy single-string format.
                $settings['source_entry_policies']['manual'] = 'pending';

                DB::table('config_brand_policies')
                    ->where('id', $row->id)
                    ->update([
                        'settings' => json_encode($settings),
                        'updated_at' => now(),
                    ]);
            });
    }
};
