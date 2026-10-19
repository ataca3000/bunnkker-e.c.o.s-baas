<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_pipeline_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false); // system templates cannot be deleted
            $table->jsonb('stages');   // array of StageConfig
            $table->jsonb('metadata')->nullable(); // arbitrary template-level options
            $table->timestamps();

            $table->index(['slug', 'is_active']);
        });

        // Also add template_id FK to engineering_pipelines
        Schema::table('engineering_pipelines', function (Blueprint $table): void {
            $table->uuid('template_id')->nullable()->after('id');
            $table->string('template_slug')->nullable()->after('template_id');
            $table->foreign('template_id')
                  ->references('id')
                  ->on('engineering_pipeline_templates')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('engineering_pipelines', function (Blueprint $table): void {
            $table->dropForeign(['template_id']);
            $table->dropColumn(['template_id', 'template_slug']);
        });

        Schema::dropIfExists('engineering_pipeline_templates');
    }
};
