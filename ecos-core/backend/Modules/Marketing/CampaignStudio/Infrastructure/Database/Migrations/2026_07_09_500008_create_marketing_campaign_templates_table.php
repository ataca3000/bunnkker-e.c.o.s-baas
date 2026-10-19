<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_templates')) {
            return;
        }

        Schema::create('marketing_campaign_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('company_id', 36)->nullable()->index();

            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('category', 50)->default('custom');
            $table->text('preview_image_url')->nullable();

            // Default campaign settings
            $table->string('default_objective', 100)->nullable();
            $table->string('default_buying_type', 50)->nullable()->default('AUCTION');
            $table->string('default_budget_type', 20)->nullable()->default('daily');
            $table->decimal('default_daily_budget', 14, 2)->nullable();
            $table->string('default_bid_strategy', 100)->nullable();
            $table->string('default_optimization_goal', 100)->nullable();

            // Preset data
            $table->json('default_audience')->nullable();
            $table->json('default_placements')->nullable();
            $table->string('default_business_goal', 50)->nullable();
            $table->string('default_season', 50)->nullable();

            // Requirements
            $table->json('required_assets')->nullable();
            $table->json('required_utm_params')->nullable();
            $table->uuid('approval_workflow_id')->nullable();

            $table->boolean('is_global')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('usage_count')->default(0);
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_templates');
    }
};
