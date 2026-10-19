<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('purchase_order_lines', 'description')) {
            return;
        }

        Schema::table('purchase_order_lines', function (Blueprint $table): void {
            $table->string('description')->nullable()->after('product_id');
            // Cumulative quantity received across all posted Goods Receipts for this line.
            // Updated atomically by PostGoodsReceiptAction inside a DB transaction.
            $table->decimal('received_qty', 15, 4)->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_order_lines', 'description')) {
            return;
        }

        Schema::table('purchase_order_lines', function (Blueprint $table): void {
            $table->dropColumn(['description', 'received_qty']);
        });
    }
};
