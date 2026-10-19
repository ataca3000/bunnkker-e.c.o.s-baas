<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('pricing_reviews', 'suggested_sale_price')) {
            return;
        }

        Schema::table('pricing_reviews', function (Blueprint $table) {
            $table->decimal('suggested_sale_price', 15, 4)->nullable()->after('suggested_selling_price');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('pricing_reviews', 'suggested_sale_price')) {
            return;
        }

        Schema::table('pricing_reviews', function (Blueprint $table) {
            $table->dropColumn('suggested_sale_price');
        });
    }
};
