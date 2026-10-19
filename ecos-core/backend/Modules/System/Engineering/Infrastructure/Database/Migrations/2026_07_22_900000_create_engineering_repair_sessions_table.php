<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_sessions')) {
            return;
        }

        Schema::create('engineering_repair_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('source_type');
            $table->uuid('source_id')->nullable();
            $table->string('status')->default('pending');
            $table->string('failure_type');
            $table->text('failure_summary');
            $table->json('failure_context')->nullable();
            $table->string('root_cause_category')->nullable();
            $table->text('root_cause_description')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->unsignedInteger('max_retries')->default(3);
            $table->unsignedInteger('timeout_seconds')->default(300);
            $table->timestamp('timeout_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('failed_reason')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index('company_id');
            $table->index(['company_id', 'status']);
            $table->index('source_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_sessions');
    }
};
