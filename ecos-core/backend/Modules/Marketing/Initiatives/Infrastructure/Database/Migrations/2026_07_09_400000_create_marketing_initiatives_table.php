<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marketing Initiatives — ERP Business Entity.
 *
 * An Initiative represents a complete business objective that may contain
 * one or many Meta Campaigns. This entity exists ONLY inside ECOS.
 * It is NEVER synchronized from Meta. It is NEVER sent to Meta.
 * It is the ERP business layer ABOVE Campaigns.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_initiatives')) {
            return;
        }

        Schema::create('marketing_initiatives', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Business ownership
            $table->string('company_id', 36)->nullable()->index('mkt_init_company_idx');
            $table->string('brand_id', 36)->nullable()->index('mkt_init_brand_idx');
            $table->string('channel_id', 36)->nullable()->index('mkt_init_channel_idx');
            $table->string('template_id', 36)->nullable()->index('mkt_init_tpl_idx');

            // Core identity
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('status', 30)->default('draft')->index('mkt_init_status_idx');

            // Business classification
            $table->string('business_unit', 100)->nullable();
            $table->string('season', 50)->nullable();
            $table->string('business_goal', 100)->nullable();
            $table->string('cost_center', 100)->nullable();

            // Budget
            $table->decimal('budget', 14, 2)->nullable();
            $table->string('currency', 10)->default('EGP');

            // Timeline
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();

            // Ownership
            $table->string('owner_id', 36)->nullable()->index('mkt_init_owner_idx');
            $table->string('marketing_team', 100)->nullable();

            // Internal
            $table->text('internal_notes')->nullable();
            $table->json('tags')->nullable();
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();

            $table->timestamps();

            // Composite indexes for common queries
            $table->index(['status', 'company_id'], 'mkt_init_status_co_idx');
            $table->index(['start_date', 'end_date'], 'mkt_init_dates_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_initiatives');
    }
};
