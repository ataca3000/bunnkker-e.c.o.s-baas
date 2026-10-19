<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * HR & Workforce OS — EPIC H1. Employee documents.
 *
 * Contracts, identity papers, certificates and permits attached to a person, with
 * an optional expiry so renewals can be surfaced before they lapse.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_employee_documents')) {
            return;
        }

        Schema::create('hr_employee_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignUuid('employee_id')->constrained('hr_employees')->cascadeOnDelete();

            $table->string('type', 40)->default('other');
            $table->string('title', 200);
            $table->string('file_path', 400)->nullable();
            $table->string('file_name', 200)->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();

            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('reference', 100)->nullable();
            $table->string('notes', 400)->nullable();

            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'employee_id'], 'hr_document_employee_idx');
            $table->index(['company_id', 'expires_at'], 'hr_document_expiry_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_employee_documents');
    }
};
