<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_branch_locks')) {
            return;
        }

        Schema::create('engineering_branch_locks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            // 500 + 255 chars: composite unique must stay under the
            // 3072-byte (768-char utf8mb4) MySQL index limit.
            $table->string('repository_path', 500);
            $table->string('branch_name', 255);
            $table->uuid('worker_id')->index();
            $table->uuid('task_id')->index();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('acquired_at');
            $table->timestamps();

            $table->unique(['repository_path', 'branch_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_branch_locks');
    }
};
