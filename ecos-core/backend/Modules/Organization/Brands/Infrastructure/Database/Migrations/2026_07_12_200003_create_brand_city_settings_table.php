<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('brand_city_settings')) {
            return;
        }

        Schema::create('brand_city_settings', function (Blueprint $table): void {
            $table->id();
            $table->uuid('brand_id');
            $table->unsignedBigInteger('city_id');
            $table->boolean('is_enabled')->nullable()
                ->comment('NULL = inherit from brand_governorate_settings');
            $table->decimal('shipping_price', 10, 2)->nullable()
                ->comment('NULL = use brand_governorate_settings.shipping_price cascade');
            $table->boolean('supports_cod')->nullable()
                ->comment('NULL = inherit brand default_cod_enabled');
            $table->boolean('is_remote_override')->nullable()
                ->comment('NULL = use logistics_cities.is_remote_area');
            $table->timestamps();

            $table->unique(['brand_id', 'city_id']);

            $table->foreign('brand_id')
                ->references('id')
                ->on('brands')
                ->cascadeOnDelete();

            $table->foreign('city_id')
                ->references('id')
                ->on('logistics_cities')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_city_settings');
    }
};
