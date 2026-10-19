<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_entity_nodes')) {
            return;
        }

        Schema::create('bae_entity_nodes', static function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->string('node_type', 50);        // NodeType enum: customer, order, campaign …
            $table->uuid('entity_id');
            $table->string('entity_type', 100);
            $table->uuid('company_id')->nullable();
            $table->string('label', 255)->nullable();
            $table->json('properties')->nullable();

            $table->timestamps();

            $table->unique(['node_type', 'entity_id'], 'bae_en_type_entity_uq');
            $table->index(['company_id', 'node_type'], 'bae_en_co_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_entity_nodes');
    }
};
