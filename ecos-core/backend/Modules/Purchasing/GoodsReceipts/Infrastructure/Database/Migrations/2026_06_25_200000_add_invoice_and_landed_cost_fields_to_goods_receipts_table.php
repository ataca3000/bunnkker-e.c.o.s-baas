<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('goods_receipts', 'supplier_invoice_number')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->string('supplier_invoice_number')->nullable()->after('notes');
            $table->date('supplier_invoice_date')->nullable()->after('supplier_invoice_number');
            $table->string('invoice_attachment_path')->nullable()->after('supplier_invoice_date');
            $table->decimal('shipping_amount', 15, 2)->default(0)->after('invoice_attachment_path');
            $table->decimal('taxes_amount', 15, 2)->default(0)->after('shipping_amount');
            $table->decimal('other_costs_amount', 15, 2)->default(0)->after('taxes_amount');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('goods_receipts', 'supplier_invoice_number')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->dropColumn([
                'supplier_invoice_number',
                'supplier_invoice_date',
                'invoice_attachment_path',
                'shipping_amount',
                'taxes_amount',
                'other_costs_amount',
            ]);
        });
    }
};
