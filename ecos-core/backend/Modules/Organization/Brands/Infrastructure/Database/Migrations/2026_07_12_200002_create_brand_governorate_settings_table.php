<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('brand_governorate_settings')) {
            return;
        }

        Schema::create('brand_governorate_settings', function (Blueprint $table): void {
            $table->id();
            $table->uuid('brand_id');
            $table->unsignedBigInteger('governorate_id');
            $table->boolean('is_enabled')->default(true);
            $table->decimal('shipping_price', 10, 2)->nullable()
                ->comment('NULL = use logistics_governorates.default_shipping_price');
            $table->unsignedTinyInteger('estimated_delivery_days')->nullable();
            $table->boolean('same_day_supported')->default(false);
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->timestamps();

            $table->unique(['brand_id', 'governorate_id']);

            $table->foreign('brand_id')
                ->references('id')
                ->on('brands')
                ->cascadeOnDelete();

            $table->foreign('governorate_id')
                ->references('id')
                ->on('logistics_governorates')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_governorate_settings');
    }
};
