<?php
declare(strict_types=1);
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void {
        if (Schema::hasTable('engineering_ai_history')) { return; }
        Schema::create('engineering_ai_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->uuid('review_id')->index();
            $table->string('subject_type')->nullable();
            $table->uuid('subject_id')->nullable();
            $table->decimal('overall_score', 5, 2)->nullable();
            $table->string('recommendation')->nullable();
            $table->json('risk_summary')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
        });
    }
    public function down(): void { Schema::dropIfExists('engineering_ai_history'); }
};
