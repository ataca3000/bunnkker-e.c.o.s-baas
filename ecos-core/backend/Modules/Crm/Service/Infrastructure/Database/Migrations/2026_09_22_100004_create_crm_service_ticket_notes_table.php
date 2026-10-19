<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Service — EPIC C3. Ticket notes (internal / public).
 *
 * Internal notes are for agents; public notes are visible to the customer as the
 * reply thread. Notes are an append-only conversation on the case.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_service_ticket_notes')) {
            return;
        }

        Schema::create('crm_service_ticket_notes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('ticket_id')->constrained('crm_service_tickets')->cascadeOnDelete();
            $table->string('visibility', 10)->default('internal'); // internal | public
            $table->text('body');
            $table->unsignedBigInteger('author_id')->nullable();
            $table->timestamps();

            $table->index(['ticket_id', 'visibility'], 'crm_tnote_ticket_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_service_ticket_notes');
    }
};
