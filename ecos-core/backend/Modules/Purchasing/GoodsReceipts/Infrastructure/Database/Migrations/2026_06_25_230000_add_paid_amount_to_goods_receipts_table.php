<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('goods_receipts', 'paid_amount')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->decimal('paid_amount', 15, 2)->default(0)->after('invoice_total_amount');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('goods_receipts', 'paid_amount')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->dropColumn('paid_amount');
        });
    }
};
