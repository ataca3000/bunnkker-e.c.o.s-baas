<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('products', 'image_url')) {
            return;
        }

        Schema::table('products', function (Blueprint $table): void {
            $table->string('image_url')->nullable()->after('barcode');
            $table->decimal('regular_price', 12, 2)->nullable()->after('image_url');
            $table->decimal('sale_price', 12, 2)->nullable()->after('regular_price');
            $table->text('short_description')->nullable()->after('description');
            $table->text('long_description')->nullable()->after('short_description');
            $table->string('stock_status')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn([
                'image_url',
                'regular_price',
                'sale_price',
                'short_description',
                'long_description',
                'stock_status',
            ]);
        });
    }
};
