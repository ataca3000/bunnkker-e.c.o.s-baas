<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_workspace_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->string('workspace_type', 50)->default('process');
            $table->string('status', 50)->default('pending');
            $table->string('repository_path', 1000)->nullable();
            $table->string('base_branch', 255)->nullable();
            $table->string('task_branch', 255)->nullable();
            $table->boolean('cache_hit')->default(false);
            $table->integer('provisioning_duration_ms')->nullable();
            $table->timestamp('provisioned_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->foreign('session_id')
                ->references('id')
                ->on('engineering_execution_sessions')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_workspace_sessions');
    }
};
