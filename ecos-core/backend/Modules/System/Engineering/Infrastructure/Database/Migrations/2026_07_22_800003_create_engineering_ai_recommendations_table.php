<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_ai_recommendations')) { return; }
        Schema::create('engineering_ai_recommendations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('review_id')->index();
            $table->uuid('company_id')->index();
            $table->string('type'); // immediate_fix, suggested_improvement, future_refactoring, technical_debt, architecture_improvement, performance_improvement, security_improvement, documentation_improvement
            $table->string('priority'); // critical, high, medium, low
            $table->string('category');
            $table->string('title');
            $table->text('description');
            $table->string('effort_estimate')->default('medium'); // trivial, low, medium, high, very_high
            $table->boolean('is_resolved')->default(false);
            $table->uuid('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_recommendations'); }
};
