<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'custom_discount_pct')) {
            return;
        }

        Schema::table('products', function (Blueprint $table) {
            $table->decimal('custom_discount_pct', 8, 4)->nullable()->after('custom_markup');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'custom_discount_pct')) {
            return;
        }

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('custom_discount_pct');
        });
    }
};
