<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_ai_reviews')) { return; }
        Schema::create('engineering_ai_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('review_type')->default('manual'); // task, release, codebase, scheduled, manual
            $table->string('status')->default('pending');    // pending, running, completed, failed, cancelled
            $table->string('subject_type')->nullable();      // task, release
            $table->uuid('subject_id')->nullable();
            $table->uuid('triggered_by')->nullable();
            $table->timestamp('triggered_at')->useCurrent();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->decimal('overall_score', 5, 2)->nullable();
            $table->string('recommendation')->nullable(); // approve, approve_with_warnings, needs_review, reject, critical_block
            $table->text('justification')->nullable();
            $table->text('summary')->nullable();
            $table->json('dimensions')->nullable();
            $table->unsignedInteger('risk_count_critical')->default(0);
            $table->unsignedInteger('risk_count_high')->default(0);
            $table->unsignedInteger('risk_count_medium')->default(0);
            $table->unsignedInteger('risk_count_low')->default(0);
            $table->boolean('is_blocking')->default(false);
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->index(['company_id', 'status']);
            $table->index(['subject_type', 'subject_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_reviews'); }
};
