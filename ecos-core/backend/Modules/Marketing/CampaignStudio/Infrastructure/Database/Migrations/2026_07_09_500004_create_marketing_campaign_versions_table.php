<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Immutable version history — no updated_at
        if (Schema::hasTable('marketing_campaign_versions')) {
            return;
        }

        Schema::create('marketing_campaign_versions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();

            $table->unsignedInteger('version_number');
            $table->string('change_type', 50)->default('initial');
            $table->json('snapshot');
            $table->json('changed_fields')->nullable();
            $table->text('change_note')->nullable();

            // Who made the change
            $table->string('changed_by_user_id', 36)->nullable();

            // Approval meta (when change_type = approval_decision)
            $table->string('approval_decision', 30)->nullable();
            $table->string('approved_by_user_id', 36)->nullable();
            $table->timestamp('approval_decided_at')->nullable();

            // No updated_at — immutable
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::table('marketing_campaign_versions', function (Blueprint $table): void {
            $table->unique(['campaign_draft_id', 'version_number'], 'mkt_cv_draft_version_unique');
            $table->index(['campaign_draft_id', 'created_at'], 'mkt_cv_draft_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_versions');
    }
};
