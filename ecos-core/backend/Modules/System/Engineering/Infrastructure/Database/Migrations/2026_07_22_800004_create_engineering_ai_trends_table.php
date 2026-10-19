<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_ai_trends')) { return; }
        Schema::create('engineering_ai_trends', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->string('period_type'); // daily, weekly, monthly
            $table->string('period_label'); // 2026-07-22, 2026-W29, 2026-07
            $table->decimal('overall_score', 5, 2)->nullable();
            $table->json('dimension_scores')->nullable();
            $table->unsignedInteger('review_count')->default(0);
            $table->unsignedInteger('risk_count')->default(0);
            $table->unsignedInteger('recommendation_count')->default(0);
            $table->unsignedInteger('avg_review_duration_seconds')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['company_id', 'period_type', 'period_label']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_trends'); }
};
