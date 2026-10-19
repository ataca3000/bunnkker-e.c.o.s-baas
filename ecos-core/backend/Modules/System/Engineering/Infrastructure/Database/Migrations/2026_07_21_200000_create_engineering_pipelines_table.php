<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_pipelines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('task_name')->nullable();
            $table->string('branch')->default('main');
            $table->string('commit_sha', 40)->nullable();
            $table->string('status', 30)->default('pending'); // pending|running|completed|failed|cancelled
            $table->string('current_stage', 100)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('initiated_by')->default('Claude');
            $table->uuid('initiated_by_user_id')->nullable();
            $table->text('error_message')->nullable();
            $table->boolean('auto_deploy')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('branch');
            $table->index('started_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_pipelines');
    }
};
