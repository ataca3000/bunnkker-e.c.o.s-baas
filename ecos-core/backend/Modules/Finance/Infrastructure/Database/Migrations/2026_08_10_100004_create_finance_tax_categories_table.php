<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F1. Tax categories.
 *
 * The classification a tax code belongs to (Standard VAT, Zero-rated, Exempt,
 * Withholding, …) and whether input tax under it is recoverable. ETA e-invoice
 * integration is explicitly out of F1 scope; this is the VAT foundation only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_tax_categories', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');

            $table->string('code', 40);
            $table->string('name', 200);
            $table->string('name_ar', 200)->nullable();

            // Whether input tax under this category may be reclaimed.
            $table->boolean('is_recoverable')->default(true);

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'finance_taxcat_company_code_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_tax_categories');
    }
};
