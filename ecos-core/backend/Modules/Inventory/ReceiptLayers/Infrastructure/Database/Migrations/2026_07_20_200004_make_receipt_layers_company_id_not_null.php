<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * L-04: Make inventory_receipt_layers.company_id NOT NULL.
 *
 * company_id was added as nullable in the backfill migration
 * (2026_07_20_000001) to allow the backfill UPDATE to run first.
 * All rows now have a company_id value (verified by the backfill).
 * Making it NOT NULL enforces the tenant isolation contract at the
 * database level — a receipt layer without a company is invisible
 * to all company-scoped FIFO queries.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->uuid('company_id')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->uuid('company_id')->nullable()->change();
        });
    }
};
