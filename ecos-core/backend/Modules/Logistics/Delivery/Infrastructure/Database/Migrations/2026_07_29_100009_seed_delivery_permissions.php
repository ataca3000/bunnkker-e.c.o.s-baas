<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Registers the Delivery OS permission set in the IAM catalogue.
 *
 * Idempotent: each permission is keyed on its unique name, so re-running is a
 * no-op. No role is granted anything here — assignment stays an operator
 * decision.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['delivery.view', 'view', 'View deliveries and their timeline'],
        ['delivery.execute', 'execute', 'Open and close delivery attempts'],
        ['delivery.pod.capture', 'pod.capture', 'Capture proof of delivery'],
        ['delivery.pod.validate', 'pod.validate', 'Validate or reject proof of delivery'],
        ['delivery.retry', 'retry', 'Schedule or cancel a delivery retry'],
        ['delivery.cancel', 'cancel', 'Cancel a delivery'],
        ['delivery.return.manage', 'return.manage', 'Initiate, receive and verify delivery returns'],
        ['delivery.cod.collect', 'cod.collect', 'Record COD collection at the door'],
        ['delivery.cod.verify', 'cod.verify', 'Verify or dispute a COD record'],
        ['delivery.analytics.view', 'analytics.view', 'View delivery analytics and SLA reporting'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $action, $description]) {
            $exists = DB::table('permissions')->where('name', $name)->exists();

            if ($exists) {
                continue;
            }

            DB::table('permissions')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'module' => 'logistics',
                'resource' => 'delivery',
                'action' => $action,
                'description' => $description,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', array_column(self::PERMISSIONS, 0))
            ->delete();
    }
};
