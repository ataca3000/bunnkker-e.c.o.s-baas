<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('(UUID())'));
            $table->string('company_id', 36)->index();
            $table->string('subject_type', 100)->index();
            $table->string('subject_id', 36)->index();
            $table->string('document_type', 100)->index();
            $table->string('name', 255);
            $table->string('file_path', 500);
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->text('notes')->nullable();
            $table->string('version', 20)->default('1.0');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['subject_type', 'subject_id'], 'idx_documents_subject');
            $table->index(['company_id', 'document_type'], 'idx_documents_company_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
