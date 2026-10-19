<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-PATCH-001 Fix 4 — Remove hardcoded 'SAR' default from supplier_invoices.currency.
 *
 * Currency is now resolved from the company's configured currency at the application
 * layer (SupplierInvoiceController), making the system multi-currency ready.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('supplier_invoices', function (Blueprint $table): void {
            $table->string('currency', 3)->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        Schema::table('supplier_invoices', function (Blueprint $table): void {
            $table->string('currency', 3)->default('SAR')->change();
        });
    }
};
