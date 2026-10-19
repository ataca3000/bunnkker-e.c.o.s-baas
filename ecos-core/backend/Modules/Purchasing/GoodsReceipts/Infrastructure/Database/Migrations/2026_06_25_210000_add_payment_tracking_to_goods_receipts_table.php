<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * COM-010A-R2 — Supplier Invoice & Payment Tracking Enhancement
 *
 * Renames three landed-cost columns to standard invoice terminology,
 * adds the invoice total amount, and adds payment tracking fields
 * (status, method, terms, due date) for future AP integration.
 *
 * NO accounting tables, NO ledger entries, NO financial transactions.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Step 1: rename cost columns to standard invoice terminology
        if (Schema::hasColumn('goods_receipts', 'invoice_total_amount')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->renameColumn('shipping_amount', 'freight_amount');
            $table->renameColumn('taxes_amount', 'tax_amount');
            $table->renameColumn('other_costs_amount', 'additional_costs');
        });

        // Step 2: add invoice financial + payment tracking fields
        if (Schema::hasColumn('goods_receipts', 'invoice_total_amount')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->decimal('invoice_total_amount', 15, 2)->default(0)->after('additional_costs');

            $table->string('payment_status', 50)->default('unpaid')->after('invoice_total_amount');
            $table->string('payment_method', 50)->nullable()->after('payment_status');
            $table->unsignedSmallInteger('payment_terms_days')->nullable()->after('payment_method');
            $table->date('payment_due_date')->nullable()->after('payment_terms_days');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('goods_receipts', 'invoice_total_amount')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->dropColumn([
                'invoice_total_amount',
                'payment_status',
                'payment_method',
                'payment_terms_days',
                'payment_due_date',
            ]);
        });

        if (Schema::hasColumn('goods_receipts', 'invoice_total_amount')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->renameColumn('freight_amount', 'shipping_amount');
            $table->renameColumn('tax_amount', 'taxes_amount');
            $table->renameColumn('additional_costs', 'other_costs_amount');
        });
    }
};
