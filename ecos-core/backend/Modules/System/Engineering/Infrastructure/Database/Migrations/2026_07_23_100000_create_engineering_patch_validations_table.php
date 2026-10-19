<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_patch_validations')) {
            return;
        }

        Schema::create('engineering_patch_validations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('patch_id');
            $table->uuid('session_id');
            $table->unsignedInteger('attempt_number')->default(1);
            $table->string('status')->default('pending');
            $table->string('verdict')->nullable();
            $table->unsignedInteger('total_steps')->default(0);
            $table->unsignedInteger('passed_steps')->default(0);
            $table->unsignedInteger('failed_steps')->default(0);
            $table->unsignedInteger('skipped_steps')->default(0);
            $table->boolean('is_blocking_failure')->default(false);
            $table->uuid('triggered_by')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('failure_summary')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index('company_id');
            $table->index(['patch_id', 'attempt_number']);
            $table->index('session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_patch_validations');
    }
};
