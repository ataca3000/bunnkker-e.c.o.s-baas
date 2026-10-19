<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_campaign_validation_results')) {
            return;
        }

        Schema::create('marketing_campaign_validation_results', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('campaign_draft_id')->index();

            $table->string('validation_type', 50);
            $table->string('severity', 30)->default('warning');
            $table->text('message');
            $table->string('field_path', 255)->nullable();
            $table->json('context')->nullable();

            $table->boolean('is_resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('validated_at')->useCurrent();

            // Immutable result — no updated_at
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::table('marketing_campaign_validation_results', function (Blueprint $table): void {
            $table->index(['campaign_draft_id', 'severity', 'is_resolved'], 'mkt_cvr_draft_severity_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_campaign_validation_results');
    }
};
