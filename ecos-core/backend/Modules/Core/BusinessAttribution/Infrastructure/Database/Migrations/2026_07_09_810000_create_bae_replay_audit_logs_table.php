<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_replay_audit_logs')) {
            return;
        }

        Schema::create('bae_replay_audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('user_type', 50)->nullable()->default('user');
            $table->string('target_entity_type', 100)->nullable();
            $table->uuid('target_entity_id')->nullable();
            $table->uuid('target_dna_id')->nullable();
            // entity|journey|timeline|event_range|batch|module|root_cause|time_machine
            $table->string('replay_type', 50);
            $table->timestamp('replay_from')->nullable();
            $table->timestamp('replay_to')->nullable();
            $table->timestamp('replay_as_of')->nullable();
            $table->string('replay_purpose', 255)->nullable();
            $table->unsignedInteger('events_replayed')->default(0);
            $table->unsignedInteger('duration_ms')->nullable();
            $table->string('status', 50)->default('completed'); // completed|failed|partial
            $table->json('metadata')->nullable();
            $table->timestamp('executed_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['target_entity_type', 'target_entity_id'], 'bae_ral_entity_idx');
            $table->index(['user_id', 'executed_at'], 'bae_ral_user_idx');
            $table->index('replay_type', 'bae_ral_type_idx');
            $table->index('executed_at', 'bae_ral_executed_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_replay_audit_logs');
    }
};
