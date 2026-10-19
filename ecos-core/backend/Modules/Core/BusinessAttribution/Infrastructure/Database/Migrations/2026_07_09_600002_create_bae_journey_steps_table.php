<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_journey_steps')) {
            return;
        }

        Schema::create('bae_journey_steps', static function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('business_dna_id');
            $table->string('journey_stage', 50);

            // Link back to the event that triggered this step
            $table->uuid('event_id')->nullable();

            // Actor
            $table->uuid('actor_id')->nullable();
            $table->string('actor_type', 100)->nullable();

            $table->timestamp('occurred_at');
            $table->unsignedBigInteger('duration_seconds')->nullable();

            // Linked step chain
            $table->uuid('previous_step_id')->nullable();

            // Related entity
            $table->uuid('related_entity_id')->nullable();
            $table->string('related_entity_type', 100)->nullable();

            $table->json('payload')->nullable();

            // Append-only
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('business_dna_id')
                ->references('id')->on('bae_business_dna')
                ->cascadeOnDelete();

            $table->index(['business_dna_id', 'occurred_at'], 'bae_js_dna_at_idx');
            $table->index(['business_dna_id', 'journey_stage'], 'bae_js_dna_stage_idx');
            $table->index('event_id', 'bae_js_event_idx');
            $table->index('previous_step_id', 'bae_js_prev_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_journey_steps');
    }
};
