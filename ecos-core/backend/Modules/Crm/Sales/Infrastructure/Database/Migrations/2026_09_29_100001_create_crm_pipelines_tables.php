<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Sales pipelines and their stages.
 *
 * A pipeline is an ordered set of stages an opportunity moves through; each stage
 * carries a win probability. Won/lost stages close the deal.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('crm_pipelines')) {
            Schema::create('crm_pipelines', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->nullable();
                $table->string('name', 120);
                $table->boolean('is_default')->default(false);
                $table->timestamps();

                $table->index(['company_id', 'is_default'], 'crm_pipeline_company_idx');
            });
        }

        if (! Schema::hasTable('crm_pipeline_stages')) {
            Schema::create('crm_pipeline_stages', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('pipeline_id')->constrained('crm_pipelines')->cascadeOnDelete();
                $table->string('name', 120);
                $table->integer('order')->default(0);
                $table->unsignedTinyInteger('probability')->default(0); // 0..100
                $table->boolean('is_won')->default(false);
                $table->boolean('is_lost')->default(false);
                $table->timestamps();

                $table->index(['pipeline_id', 'order'], 'crm_stage_order_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_pipeline_stages');
        Schema::dropIfExists('crm_pipelines');
    }
};
