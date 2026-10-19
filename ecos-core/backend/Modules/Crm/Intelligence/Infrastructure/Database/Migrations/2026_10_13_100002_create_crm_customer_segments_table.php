<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Intelligence — EPIC C5. Segment definitions.
 *
 * The named, explainable RFM segments a customer can fall into (Champions, At
 * Risk, Hibernating …). Deterministic: a customer's segment is derived from its
 * RFM scores, not assigned by hand. Rows here give each segment a stable key,
 * label, colour and retention focus flag for reporting.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_segments')) {
            return;
        }

        Schema::create('crm_customer_segments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();   // null = system-defined template
            $table->string('key', 40);
            $table->string('name', 120);
            $table->string('description', 300)->nullable();
            $table->string('color', 20)->nullable();
            $table->unsignedSmallInteger('priority')->default(100);
            $table->boolean('is_retention_focus')->default(false);
            $table->boolean('is_system')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'key'], 'crm_segment_key_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_segments');
    }
};
