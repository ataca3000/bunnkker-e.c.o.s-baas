<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('pipeline_id')
                ->nullable()
                ->constrained('engineering_pipelines')
                ->nullOnDelete();
            $table->string('type', 100); // pipeline_started|pipeline_failed|pipeline_completed|deployment_failed|certification_failed|health_check_failed
            $table->string('title');
            $table->text('message');
            $table->string('severity', 20)->default('info'); // info|warning|error|success
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('type');
            $table->index('is_read');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_notifications');
    }
};
