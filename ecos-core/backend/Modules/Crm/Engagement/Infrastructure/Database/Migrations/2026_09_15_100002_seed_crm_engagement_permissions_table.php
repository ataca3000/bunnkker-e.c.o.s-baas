<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * CRM Customer Engagement — EPIC C2. Engagement permissions.
 *
 * Under the crm domain: viewing the timeline/feed, logging activities, and
 * managing tasks/follow-ups/appointments.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['crm.engagement.view', 'engagement', 'view', 'View the customer timeline, journey and activity feed'],
        ['crm.engagement.log', 'engagement', 'log', 'Log CRM activities (calls, emails, notes, meetings)'],
        ['crm.engagement.task.manage', 'engagement', 'task', 'Create and manage tasks, follow-ups and appointments'],
    ];

    public function up(): void
    {
        if (! Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $resource, $action, $description]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            DB::table('permissions')->insert([
                'id' => (string) Str::uuid(),
                'name' => $name,
                'module' => 'crm',
                'resource' => $resource,
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

        DB::table('permissions')->whereIn('name', array_column(self::PERMISSIONS, 0))->delete();
    }
};
