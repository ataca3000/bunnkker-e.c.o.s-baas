<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_ai_release_reviews')) { return; }
        Schema::create('engineering_ai_release_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('review_id')->index();
            $table->uuid('release_id')->index();
            $table->string('recommendation')->nullable();
            $table->text('justification')->nullable();
            $table->unsignedInteger('blocking_risks_count')->default(0);
            $table->unsignedInteger('warning_risks_count')->default(0);
            $table->unsignedInteger('passed_checks')->default(0);
            $table->unsignedInteger('failed_checks')->default(0);
            $table->boolean('is_blocking')->default(false);
            $table->decimal('score_at_review', 5, 2)->nullable();
            $table->timestamp('reviewed_at')->useCurrent();
            $table->softDeletes();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_release_reviews'); }
};
