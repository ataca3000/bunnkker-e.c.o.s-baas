<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_prompts')) {
            return;
        }

        Schema::create('engineering_repair_prompts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->uuid('company_id');
            $table->unsignedInteger('prompt_version')->default(1);
            $table->string('prompt_type')->default('initial');
            $table->text('system_context');
            $table->longText('repair_instructions');
            $table->json('context_files')->nullable();
            $table->json('constraints')->nullable();
            $table->json('success_criteria')->nullable();
            $table->unsignedInteger('token_estimate')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('session_id')
                ->references('id')
                ->on('engineering_repair_sessions')
                ->cascadeOnDelete();

            $table->index(['session_id', 'is_active']);
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_prompts');
    }
};
