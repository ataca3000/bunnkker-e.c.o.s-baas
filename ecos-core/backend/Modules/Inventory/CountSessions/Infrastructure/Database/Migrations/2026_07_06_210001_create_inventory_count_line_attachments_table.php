<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_count_line_attachments')) {
            return;
        }

        Schema::create('inventory_count_line_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('count_line_id');
            $table->uuid('session_id'); // denormalized for efficient list-level aggregate queries
            $table->string('file_path');
            $table->string('file_name');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('description', 500)->nullable();
            $table->string('uploaded_by', 255)->nullable();
            $table->timestamps();

            $table->foreign('count_line_id')
                ->references('id')
                ->on('inventory_count_lines')
                ->onDelete('cascade');

            $table->foreign('session_id')
                ->references('id')
                ->on('inventory_count_sessions')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_count_line_attachments');
    }
};
