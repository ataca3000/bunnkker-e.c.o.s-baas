<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('brand_shipping_settings')) {
            return;
        }

        Schema::create('brand_shipping_settings', function (Blueprint $table): void {
            $table->id();
            $table->uuid('brand_id')->unique();
            $table->string('unsupported_governorate_action', 30)->default('allow')
                ->comment('allow | pending_review | reject');
            $table->string('unsupported_city_action', 30)->default('allow')
                ->comment('allow | pending_review | reject');
            $table->boolean('default_cod_enabled')->default(true);
            $table->decimal('default_free_shipping_threshold', 10, 2)->nullable();
            $table->string('default_shipping_provider', 50)->nullable();
            $table->timestamps();

            $table->foreign('brand_id')
                ->references('id')
                ->on('brands')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_shipping_settings');
    }
};
