<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Multiple emails.
 *
 * The full set of a customer's emails; the primary mirrors to the master's
 * legacy `email` column so existing lookups continue to resolve.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_emails')) {
            return;
        }

        Schema::create('crm_customer_emails', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('label', 30)->default('primary'); // primary | work | billing | other
            $table->string('email', 200);
            $table->string('normalized', 200)->nullable();     // lowercased/trimmed, for matching
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->timestamps();

            $table->index(['customer_id', 'is_primary'], 'crm_cemail_customer_idx');
            $table->index('normalized', 'crm_cemail_normalized_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_emails');
    }
};
