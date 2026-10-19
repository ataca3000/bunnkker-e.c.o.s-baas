<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_analyses')) {
            return;
        }

        Schema::create('engineering_repair_analyses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->uuid('company_id');
            $table->string('failure_category');
            $table->string('root_cause');
            $table->decimal('confidence_score', 5, 2)->default(0);
            $table->json('affected_components')->nullable();
            $table->json('evidence')->nullable();
            $table->string('repair_approach');
            $table->string('estimated_effort')->default('medium');
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('session_id')
                ->references('id')
                ->on('engineering_repair_sessions')
                ->cascadeOnDelete();

            $table->index('session_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_analyses');
    }
};
