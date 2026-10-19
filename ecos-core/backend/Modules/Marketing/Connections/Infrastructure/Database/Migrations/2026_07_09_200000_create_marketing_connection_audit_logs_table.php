<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Business-oriented audit trail for all Marketing OS actions.
 *
 * Stores WHO did WHAT to WHICH entity, with before/after state.
 * Future consumers: CRM, Analytics, Notification Engine, Intelligence OS.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_audit_logs')) {
            return;
        }

        Schema::create('marketing_audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Entity being audited (connection, asset, relationship, profile, etc.)
            $table->string('entity_type', 60)->index();       // 'connection' | 'asset' | 'relationship' | 'mapping_profile'
            $table->uuid('entity_id')->index();

            // Optional FK shortcuts for common query patterns
            $table->uuid('connection_id')->nullable()->index();
            $table->uuid('asset_id')->nullable()->index();

            // Action (business-language, not CRUD)
            $table->string('action', 100)->index();           // 'connected' | 'disconnected' | 'mapped' | 'unmapped' | 'synced' | etc.

            // Actor
            $table->uuid('actor_id')->nullable();
            $table->string('actor_name', 255)->nullable();    // snapshot of name at event time

            // State delta
            $table->json('before')->nullable();
            $table->json('after')->nullable();

            // Optional human reasoning
            $table->text('reason')->nullable();

            // Connector context
            $table->string('connector_type', 30)->nullable()->index();

            $table->timestamp('created_at')->useCurrent()->index();

            // Composite indexes for audit log queries
            $table->index(['entity_type', 'entity_id', 'created_at'], 'mkt_audit_entity_time_idx');
            $table->index(['actor_id', 'created_at'], 'mkt_audit_actor_time_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_audit_logs');
    }
};
