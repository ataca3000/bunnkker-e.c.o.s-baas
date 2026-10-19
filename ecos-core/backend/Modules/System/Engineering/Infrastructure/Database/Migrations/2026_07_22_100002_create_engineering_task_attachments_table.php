<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_task_attachments')) {
            return;
        }

        Schema::create('engineering_task_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->uuid('company_id');
            $table->uuid('uploaded_by_id');
            $table->string('filename', 500);
            $table->string('original_filename', 500);
            $table->string('content_type', 100);
            $table->bigInteger('size_bytes');
            $table->string('storage_disk', 50)->default('local');
            $table->string('storage_path');
            $table->string('checksum', 128)->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->index(['task_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_attachments');
    }
};
