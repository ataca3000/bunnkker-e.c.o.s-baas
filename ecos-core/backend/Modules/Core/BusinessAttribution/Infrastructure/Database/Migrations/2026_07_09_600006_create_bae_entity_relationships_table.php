<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_entity_relationships')) {
            return;
        }

        Schema::create('bae_entity_relationships', static function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('from_node_id');
            $table->uuid('to_node_id');
            $table->string('relationship_type', 50);    // RelationshipType enum

            $table->decimal('weight', 8, 4)->nullable()->default(1.0);
            $table->json('properties')->nullable();

            // Append-only: edges are immutable
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('from_node_id')
                ->references('id')->on('bae_entity_nodes')
                ->cascadeOnDelete();

            $table->foreign('to_node_id')
                ->references('id')->on('bae_entity_nodes')
                ->cascadeOnDelete();

            $table->index(['from_node_id', 'relationship_type'], 'bae_er_from_type_idx');
            $table->index(['to_node_id',   'relationship_type'], 'bae_er_to_type_idx');
            $table->index('relationship_type', 'bae_er_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_entity_relationships');
    }
};
