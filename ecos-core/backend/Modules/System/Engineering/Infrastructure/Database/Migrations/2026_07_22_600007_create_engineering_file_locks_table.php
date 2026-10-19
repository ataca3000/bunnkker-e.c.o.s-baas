<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_file_locks')) {
            return;
        }

        Schema::create('engineering_file_locks', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            // 700 chars: indexed column must stay under the 3072-byte
            // (768-char utf8mb4) MySQL index limit.
            $table->string('repository_path', 700)->index();
            $table->string('file_path', 2000);
            $table->uuid('worker_id')->index();
            $table->uuid('task_id')->index();
            $table->string('lock_type', 20)->default('write');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('acquired_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_file_locks');
    }
};
