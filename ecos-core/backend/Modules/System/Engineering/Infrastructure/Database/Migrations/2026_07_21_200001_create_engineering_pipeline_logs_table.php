<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_pipeline_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('pipeline_id')
                ->constrained('engineering_pipelines')
                ->cascadeOnDelete();
            $table->string('stage', 100);
            $table->string('status', 30)->default('pending'); // pending|running|success|failed|retrying|skipped|cancelled
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->text('message')->nullable();
            $table->json('payload')->nullable();
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->timestamps();

            $table->index(['pipeline_id', 'stage']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_pipeline_logs');
    }
};
