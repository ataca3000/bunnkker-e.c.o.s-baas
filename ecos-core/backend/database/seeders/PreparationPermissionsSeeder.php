<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PreparationPermissionsSeeder extends Seeder
{
    private const PERMISSIONS = [
        // Wave lifecycle
        ['name' => 'preparation.wave.view',     'module' => 'preparation', 'resource' => 'wave',    'action' => 'view'],
        ['name' => 'preparation.wave.create',   'module' => 'preparation', 'resource' => 'wave',    'action' => 'create'],
        ['name' => 'preparation.wave.update',   'module' => 'preparation', 'resource' => 'wave',    'action' => 'update'],
        ['name' => 'preparation.wave.delete',   'module' => 'preparation', 'resource' => 'wave',    'action' => 'delete'],
        ['name' => 'preparation.wave.start',    'module' => 'preparation', 'resource' => 'wave',    'action' => 'start'],
        ['name' => 'preparation.wave.complete', 'module' => 'preparation', 'resource' => 'wave',    'action' => 'complete'],
        ['name' => 'preparation.wave.cancel',   'module' => 'preparation', 'resource' => 'wave',    'action' => 'cancel'],
        ['name' => 'preparation.wave.approve',  'module' => 'preparation', 'resource' => 'wave',    'action' => 'approve'],
        // Workers
        ['name' => 'preparation.worker.assign',  'module' => 'preparation', 'resource' => 'worker', 'action' => 'assign'],
        ['name' => 'preparation.worker.release', 'module' => 'preparation', 'resource' => 'worker', 'action' => 'release'],
        // Stations
        ['name' => 'preparation.station.view',   'module' => 'preparation', 'resource' => 'station', 'action' => 'view'],
        ['name' => 'preparation.station.manage', 'module' => 'preparation', 'resource' => 'station', 'action' => 'manage'],
        // Pool
        ['name' => 'preparation.pool.view',   'module' => 'preparation', 'resource' => 'pool', 'action' => 'view'],
        ['name' => 'preparation.pool.manage', 'module' => 'preparation', 'resource' => 'pool', 'action' => 'manage'],
        // Analytics
        ['name' => 'preparation.analytics.view', 'module' => 'preparation', 'resource' => 'analytics', 'action' => 'view'],
        // Configuration
        ['name' => 'preparation.configuration.manage', 'module' => 'preparation', 'resource' => 'configuration', 'action' => 'manage'],
    ];

    public function run(): void
    {
        $now = now()->toDateTimeString();

        foreach (self::PERMISSIONS as $perm) {
            DB::table('permissions')->insertOrIgnore([
                'id' => Str::uuid()->toString(),
                'name' => $perm['name'],
                'module' => $perm['module'],
                'resource' => $perm['resource'],
                'action' => $perm['action'],
                'description' => "Preparation OS: {$perm['action']} {$perm['resource']}",
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command?->info('Preparation OS permissions seeded ('.count(self::PERMISSIONS).' permissions).');
    }
}
