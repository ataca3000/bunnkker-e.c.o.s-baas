<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_drafts')) {
            return;
        }

        Schema::create('marketing_campaign_drafts', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // ── Business Identity ─────────────────────────────────────────────
            $table->string('name', 500);
            $table->string('internal_status', 30)->default('draft');

            // Business context (ECOS-owned, never overwritten by provider sync)
            $table->uuid('initiative_id')->nullable()->index();
            $table->string('company_id', 36)->nullable()->index();
            $table->string('brand_id', 36)->nullable()->index();
            $table->string('channel_id', 36)->nullable()->index();
            $table->string('campaign_owner_id', 36)->nullable()->index();
            $table->string('budget_owner', 255)->nullable();
            $table->string('marketing_team', 255)->nullable();
            $table->string('cost_center', 255)->nullable();
            $table->string('season', 50)->nullable();
            $table->string('custom_season', 255)->nullable();
            $table->string('business_goal', 50)->nullable();
            $table->json('tags')->nullable();
            $table->text('internal_notes')->nullable();

            // ── Campaign Settings ─────────────────────────────────────────────
            $table->string('objective', 100)->nullable();
            $table->string('buying_type', 50)->nullable()->default('AUCTION');
            $table->string('budget_type', 20)->nullable()->default('daily');
            $table->decimal('daily_budget', 14, 2)->nullable();
            $table->decimal('lifetime_budget', 14, 2)->nullable();
            $table->string('bid_strategy', 100)->nullable();
            $table->string('optimization_goal', 100)->nullable();
            $table->string('timezone', 100)->nullable()->default('Africa/Cairo');
            $table->timestamp('start_date')->nullable();
            $table->timestamp('end_date')->nullable();

            // ── Connected Provider Assets ─────────────────────────────────────
            $table->string('connector_type', 30)->nullable()->default('meta');
            $table->uuid('connection_id')->nullable()->index();
            $table->string('ad_account_id', 255)->nullable();
            $table->string('business_manager_id', 255)->nullable();
            $table->string('page_id', 255)->nullable();
            $table->string('instagram_account_id', 255)->nullable();
            $table->string('pixel_id', 255)->nullable();
            $table->string('catalog_id', 255)->nullable();
            $table->string('domain', 500)->nullable();

            // ── Provider Identity (filled after publishing) ───────────────────
            $table->string('external_campaign_id', 255)->nullable()->index();
            $table->string('external_account_id', 255)->nullable();
            $table->uuid('linked_campaign_id')->nullable()->comment('FK to marketing_campaigns after sync');

            // ── Versioning ───────────────────────────────────────────────────
            $table->unsignedInteger('current_version_number')->default(1);
            $table->uuid('current_version_id')->nullable();

            // ── Workflow ─────────────────────────────────────────────────────
            $table->uuid('approval_workflow_id')->nullable()->index();
            $table->uuid('template_id')->nullable()->index();
            $table->uuid('governance_policy_id')->nullable()->index();

            // ── Publishing Tracking ───────────────────────────────────────────
            $table->timestamp('published_at')->nullable();
            $table->timestamp('scheduled_publish_at')->nullable();
            $table->timestamp('last_published_at')->nullable();
            $table->timestamp('submitted_for_approval_at')->nullable();

            // ── Audit ─────────────────────────────────────────────────────────
            $table->string('created_by', 36)->nullable();
            $table->string('updated_by', 36)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('marketing_campaign_drafts', function (Blueprint $table): void {
            $table->index(['internal_status', 'created_at'], 'mkt_cd_status_created_idx');
            $table->index(['connector_type', 'external_campaign_id'], 'mkt_cd_connector_ext_idx');
            $table->index(['company_id', 'internal_status'], 'mkt_cd_company_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_drafts');
    }
};
