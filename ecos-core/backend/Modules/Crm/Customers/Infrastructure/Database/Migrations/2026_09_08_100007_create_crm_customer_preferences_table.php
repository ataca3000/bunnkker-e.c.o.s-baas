<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Customer preferences (key/value).
 *
 * Structured, queryable preferences (marketing opt-in, preferred delivery
 * window, language …). One row per (customer, key) so a preference can be read,
 * set and audited independently.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_preferences')) {
            return;
        }

        Schema::create('crm_customer_preferences', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->string('key', 80);
            $table->string('value', 500)->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'key'], 'crm_cpref_customer_key_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_preferences');
    }
};
