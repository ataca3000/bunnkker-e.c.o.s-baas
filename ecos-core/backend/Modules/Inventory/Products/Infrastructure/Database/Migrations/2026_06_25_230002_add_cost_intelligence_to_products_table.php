<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'last_purchase_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('last_purchase_cost', 15, 4)->nullable()->after('sale_price');
            $table->decimal('average_cost', 15, 4)->nullable()->after('last_purchase_cost');
            $table->date('last_purchase_date')->nullable()->after('average_cost');
            // Plain UUID — no FK; supplier may be deleted while cost history remains
            $table->uuid('last_supplier_id')->nullable()->after('last_purchase_date');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'last_purchase_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['last_purchase_cost', 'average_cost', 'last_purchase_date', 'last_supplier_id']);
        });
    }
};
