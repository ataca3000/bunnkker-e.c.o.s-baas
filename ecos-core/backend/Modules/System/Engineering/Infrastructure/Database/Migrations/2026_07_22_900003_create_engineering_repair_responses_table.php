<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_responses')) {
            return;
        }

        Schema::create('engineering_repair_responses', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('session_id');
            $table->uuid('prompt_id');
            $table->string('response_type');
            $table->longText('response_content');
            $table->json('files_modified')->nullable();
            $table->decimal('confidence_score', 5, 2)->nullable();
            $table->boolean('requires_review')->default(true);
            $table->timestamp('received_at');
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_decision')->nullable();

            $table->index('session_id');
            $table->index('prompt_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_responses');
    }
};
