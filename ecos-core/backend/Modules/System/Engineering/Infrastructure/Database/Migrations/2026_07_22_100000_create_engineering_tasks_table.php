<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_tasks')) {
            return;
        }

        Schema::create('engineering_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->string('status', 50)->default('draft'); // draft|queued|assigned|accepted|running|paused|completed|failed|cancelled|released|archived
            $table->unsignedTinyInteger('priority')->default(5); // 1-10
            $table->string('source_type', 50)->nullable(); // manual|github_issue|jira|adr
            $table->string('source_ref', 255)->nullable();
            $table->uuid('assigned_agent_id')->nullable()->index();
            $table->uuid('created_by_id')->index();
            $table->uuid('updated_by_id')->nullable();
            $table->timestamp('deadline')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->unsignedSmallInteger('max_retries')->default(3);
            $table->json('metadata')->nullable();
            $table->unsignedInteger('version')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'priority']);
            $table->index(['company_id', 'assigned_agent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_tasks');
    }
};
