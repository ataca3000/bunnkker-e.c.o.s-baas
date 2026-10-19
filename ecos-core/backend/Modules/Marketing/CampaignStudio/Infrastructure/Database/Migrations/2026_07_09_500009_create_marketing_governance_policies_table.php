<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_governance_policies')) {
            return;
        }

        Schema::create('marketing_governance_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('company_id', 36)->nullable()->index();

            $table->string('name', 255);
            $table->text('description')->nullable();

            // Naming standards
            $table->string('naming_pattern', 500)->nullable();
            $table->text('naming_example')->nullable();

            // Budget guardrails
            $table->decimal('min_daily_budget', 14, 2)->nullable();
            $table->decimal('max_daily_budget', 14, 2)->nullable();
            $table->decimal('min_lifetime_budget', 14, 2)->nullable();
            $table->decimal('max_lifetime_budget', 14, 2)->nullable();

            // Required elements
            $table->json('required_utm_params')->nullable();
            $table->json('required_assets')->nullable();
            $table->boolean('pixel_required')->default(true);
            $table->boolean('approval_required')->default(true);

            // Publishing windows (array of {day, from, to})
            $table->json('publishing_windows')->nullable();
            $table->json('blocked_publishing_days')->nullable();

            // Restrictions
            $table->json('allowed_objectives')->nullable();
            $table->json('brand_restrictions')->nullable();
            $table->json('audience_restrictions')->nullable();
            $table->unsignedSmallInteger('max_audience_age_gap')->nullable();

            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_governance_policies');
    }
};
