<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bae_business_events', 'schema_version')) {
            return;
        }

        Schema::table('bae_business_events', function (Blueprint $table): void {
            // Semantic version of the event schema (distinct from the event's own 'version' field)
            $table->string('schema_version', 20)->default('1.0.0')->after('version');
            // Whether this event can participate in replay reconstruction
            $table->boolean('replay_compatible')->default(true)->after('schema_version');
            // Whether this event's payload is forward-compatible for migration
            $table->boolean('migration_compatible')->default(true)->after('replay_compatible');
            // Populated when an event name is superseded by a newer event
            $table->string('deprecated_at_version', 20)->nullable()->after('migration_compatible');
            // The new event name that replaces this deprecated event
            $table->string('replaces_event_name', 150)->nullable()->after('deprecated_at_version');
            // The specific event (by UUID) that caused this event — enables cause→effect traversal
            $table->uuid('causation_id')->nullable()->after('correlation_id');

            $table->index('causation_id', 'bae_be_causation_idx');
            $table->index(['replay_compatible', 'occurred_at'], 'bae_be_replay_idx');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('bae_business_events', 'schema_version')) {
            return;
        }

        Schema::table('bae_business_events', function (Blueprint $table): void {
            $table->dropIndex('bae_be_causation_idx');
            $table->dropIndex('bae_be_replay_idx');
            $table->dropColumn([
                'schema_version',
                'replay_compatible',
                'migration_compatible',
                'deprecated_at_version',
                'replaces_event_name',
                'causation_id',
            ]);
        });
    }
};
