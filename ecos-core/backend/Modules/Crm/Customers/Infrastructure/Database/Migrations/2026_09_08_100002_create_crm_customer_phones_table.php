<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Multiple phone numbers.
 *
 * The master carries a single legacy `phone`/`mobile`; this table holds the full
 * set, each labelled, with exactly one primary. The primary is mirrored back to
 * the legacy column so existing phone-based lookups keep working — one identity,
 * no duplicated data.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_phones')) {
            return;
        }

        Schema::create('crm_customer_phones', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('label', 30)->default('mobile'); // mobile | home | work | other
            $table->string('phone', 40);
            $table->string('normalized', 40)->nullable();     // digits only, for matching
            $table->boolean('is_primary')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->timestamps();

            $table->index(['customer_id', 'is_primary'], 'crm_cphone_customer_idx');
            $table->index('normalized', 'crm_cphone_normalized_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_phones');
    }
};
