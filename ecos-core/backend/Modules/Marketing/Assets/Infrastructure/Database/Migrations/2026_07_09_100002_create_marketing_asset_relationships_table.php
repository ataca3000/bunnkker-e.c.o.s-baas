<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_asset_relationships')) {
            return;
        }

        Schema::create('marketing_asset_relationships', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('marketing_asset_id')->index();
            $table->string('related_type', 30);                      // company | brand | channel | team
            $table->uuid('related_id');
            $table->uuid('mapped_by')->nullable();
            $table->timestamp('mapped_at')->nullable();
            $table->smallInteger('confidence')->nullable();           // 0-100, for auto-suggestions
            $table->boolean('is_auto_suggested')->default(false);
            $table->timestamp('accepted_at')->nullable();
            $table->uuid('accepted_by')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->uuid('rejected_by')->nullable();
            $table->timestamps();

            // One relationship per asset-entity pair
            $table->unique(['marketing_asset_id', 'related_type', 'related_id'], 'mar_asset_rel_unique');
            $table->index(['related_type', 'related_id'], 'mar_rel_type_id_idx');
            $table->index(['marketing_asset_id', 'related_type'], 'mar_asset_rel_type_idx');

            $table->foreign('marketing_asset_id')
                ->references('id')->on('marketing_assets')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_asset_relationships');
    }
};
