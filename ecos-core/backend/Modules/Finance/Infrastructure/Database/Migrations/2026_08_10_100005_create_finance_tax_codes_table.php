<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Tax codes.
 *
 * A concrete rate applied to a transaction (e.g. VAT 14%). It names the two GL
 * accounts the tax lands on — input (recoverable VAT asset) and output (VAT
 * payable liability) — so a future posting resolves them without guessing.
 * Recoverability is copied from the category but can be overridden per code.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_tax_codes', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('tax_category_id')->constrained('finance_tax_categories')->cascadeOnDelete();

            $table->string('code', 40);
            $table->string('name', 200);

            // vat | withholding | other
            $table->string('tax_type', 20)->default('vat');
            $table->decimal('rate', 8, 4)->default(0);       // percent, e.g. 14.0000
            $table->boolean('is_recoverable')->default(true);

            // GL accounts the tax posts to (nullable in F1 — CoA may be seeded later).
            $table->foreignId('input_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();
            $table->foreignId('output_account_id')->nullable()
                ->constrained('finance_accounts')->nullOnDelete();

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'finance_taxcode_company_code_unique');
            $table->index(['company_id', 'tax_type', 'is_active'], 'finance_taxcode_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_tax_codes');
    }
};
