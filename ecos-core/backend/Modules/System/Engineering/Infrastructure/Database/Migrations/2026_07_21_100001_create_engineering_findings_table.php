<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_findings')) {
            return;
        }

        Schema::create('engineering_findings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('engineering_run_id');
            $table->string('severity', 20);    // CRITICAL | HIGH | MEDIUM | LOW
            $table->string('category', 80);    // security-shell-exec | arch-adr | perf-large-file | ...
            $table->string('file', 500)->nullable();
            $table->integer('line')->nullable();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->text('fix_suggestion')->nullable();
            $table->timestamps();

            $table->foreign('engineering_run_id')
                ->references('id')
                ->on('engineering_runs')
                ->cascadeOnDelete();

            $table->index(['engineering_run_id', 'severity']);
            $table->index('severity');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_findings');
    }
};
