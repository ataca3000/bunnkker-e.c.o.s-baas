<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Customer notes.
 *
 * Multiple authored notes on a customer (the master keeps a single legacy
 * `notes` text for backward compatibility). Notes are an append-only trail;
 * pinning surfaces the important ones.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_notes')) {
            return;
        }

        Schema::create('crm_customer_notes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->text('body');
            $table->boolean('is_pinned')->default(false);
            $table->unsignedBigInteger('author_id')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'is_pinned'], 'crm_cnote_customer_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_notes');
    }
};
