<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'pricing_mode')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->string('pricing_mode', 20)->default('brand_policy')->after('product_cost');
            $table->decimal('custom_target_margin', 8, 4)->nullable()->after('pricing_mode');
            $table->decimal('custom_markup', 8, 4)->nullable()->after('custom_target_margin');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'pricing_mode')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['pricing_mode', 'custom_target_margin', 'custom_markup']);
        });
    }
};
