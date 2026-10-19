<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('supplier_documents')) {
            return;
        }

        Schema::create('supplier_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('supplier_id')->constrained('suppliers')->cascadeOnDelete();
            $table->string('document_type', 50);
            $table->string('name', 255);
            $table->string('file_path', 500);
            $table->string('mime_type', 100)->default('application/octet-stream');
            $table->unsignedBigInteger('file_size')->default(0);
            $table->text('notes')->nullable();
            $table->string('uploaded_by')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['supplier_id', 'document_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_documents');
    }
};
