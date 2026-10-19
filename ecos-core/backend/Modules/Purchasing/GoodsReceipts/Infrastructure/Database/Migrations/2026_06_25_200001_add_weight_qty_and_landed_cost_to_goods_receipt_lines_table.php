<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('goods_receipt_lines', 'gross_received_quantity')) {
            return;
        }

        Schema::table('goods_receipt_lines', function (Blueprint $table): void {
            // Gross weight measured before deductions; null means same as net
            $table->decimal('gross_received_quantity', 15, 4)->nullable()->after('ordered_quantity');
            // Net quantity entering inventory — the authoritative quantity for stock movements
            $table->decimal('net_received_quantity', 15, 4)->nullable()->after('gross_received_quantity');
            // net_received_quantity - ordered_quantity; negative = shortfall, positive = over-delivery
            $table->decimal('variance_quantity', 15, 4)->nullable()->after('net_received_quantity');
            // Snapshot of invoice unit price for this line
            $table->decimal('unit_price', 15, 2)->default(0)->after('variance_quantity');
            // Computed on post: unit_price + (share of header landed costs / net_received_quantity)
            $table->decimal('landed_unit_cost', 15, 4)->nullable()->after('unit_price');
            // Scale photo proving actual net weight
            $table->string('weight_photo_path')->nullable()->after('landed_unit_cost');
            $table->text('notes')->nullable()->after('weight_photo_path');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('goods_receipt_lines', 'gross_received_quantity')) {
            return;
        }

        Schema::table('goods_receipt_lines', function (Blueprint $table): void {
            $table->dropColumn([
                'gross_received_quantity',
                'net_received_quantity',
                'variance_quantity',
                'unit_price',
                'landed_unit_cost',
                'weight_photo_path',
                'notes',
            ]);
        });
    }
};
