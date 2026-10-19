<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('goods_receipt_lines', 'uom_id_snapshot')) {
            return;
        }

        Schema::table('goods_receipt_lines', function (Blueprint $table): void {
            $table->uuid('uom_id_snapshot')->nullable()->after('product_id');
            $table->string('uom_name_snapshot', 100)->nullable()->after('uom_id_snapshot');
            $table->string('uom_symbol_snapshot', 50)->nullable()->after('uom_name_snapshot');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('goods_receipt_lines', 'uom_id_snapshot')) {
            return;
        }

        Schema::table('goods_receipt_lines', function (Blueprint $table): void {
            $table->dropColumn(['uom_id_snapshot', 'uom_name_snapshot', 'uom_symbol_snapshot']);
        });
    }
};
