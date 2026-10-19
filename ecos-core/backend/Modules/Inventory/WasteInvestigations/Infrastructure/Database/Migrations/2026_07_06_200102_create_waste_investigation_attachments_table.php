<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('waste_investigation_attachments')) {
            return;
        }

        Schema::create('waste_investigation_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('investigation_id');

            $table->string('file_path', 500);
            $table->string('file_name', 255);
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable(); // bytes
            $table->text('description')->nullable();
            $table->string('uploaded_by', 255)->nullable();

            $table->timestamps();

            $table->index('investigation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_investigation_attachments');
    }
};
