<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_execution_artifacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->uuid('company_id');
            $table->string('artifact_type', 100);
            $table->string('filename', 500);
            $table->string('content_type', 100)->nullable();
            $table->bigInteger('size_bytes')->nullable();
            $table->string('storage_disk', 50)->default('local');
            $table->string('storage_path');
            $table->string('checksum', 128)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('session_id')
                ->references('id')
                ->on('engineering_execution_sessions')
                ->cascadeOnDelete();

            $table->index('session_id');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_execution_artifacts');
    }
};
