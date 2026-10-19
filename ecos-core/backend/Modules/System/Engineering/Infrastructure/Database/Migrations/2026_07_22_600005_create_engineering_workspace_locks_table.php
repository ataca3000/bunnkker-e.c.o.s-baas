<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_workspace_locks')) {
            return;
        }

        Schema::create('engineering_workspace_locks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            // 700 chars max: utf8mb4 unique index limit is 3072 bytes (768 chars).
            $table->string('workspace_path', 700);
            $table->uuid('worker_id')->index();
            $table->uuid('task_id')->index();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('acquired_at');
            $table->string('lock_reason', 500)->nullable();
            $table->timestamps();

            $table->unique(['workspace_path']);
            $table->index(['expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_workspace_locks');
    }
};
