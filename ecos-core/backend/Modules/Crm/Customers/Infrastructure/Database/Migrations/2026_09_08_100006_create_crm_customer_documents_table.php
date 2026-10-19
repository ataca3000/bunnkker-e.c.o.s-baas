<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Customer documents (metadata).
 *
 * Records document metadata attached to a customer (a contract, an ID, a tax
 * card): its type, storage path and size. The bytes live in the storage layer;
 * this table is the index.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_documents')) {
            return;
        }

        Schema::create('crm_customer_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('name', 200);
            $table->string('doc_type', 40)->nullable(); // contract | id | tax_card | other
            $table->string('file_path', 500);
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();

            $table->index('customer_id', 'crm_cdoc_customer_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_documents');
    }
};
