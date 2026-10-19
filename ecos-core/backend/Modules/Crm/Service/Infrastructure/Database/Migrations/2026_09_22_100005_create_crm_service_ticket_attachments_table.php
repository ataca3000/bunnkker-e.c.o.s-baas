<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Ticket attachments (metadata).
 *
 * The index of files attached to a case; the bytes live in the storage layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_service_ticket_attachments')) {
            return;
        }

        Schema::create('crm_service_ticket_attachments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('ticket_id')->constrained('crm_service_tickets')->cascadeOnDelete();
            $table->string('name', 200);
            $table->string('file_path', 500);
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('visibility', 10)->default('internal');
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();

            $table->index('ticket_id', 'crm_tattach_ticket_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_service_ticket_attachments');
    }
};
