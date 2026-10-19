<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_governorates')) {
            return;
        }

        Schema::create('logistics_governorates', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('country_id')->default(1); // 1 = Egypt
            $table->string('name_ar', 100);
            $table->string('name_en', 100);
            $table->decimal('default_shipping_price', 10, 2)->default(0);
            $table->unsignedSmallInteger('display_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system')->default(false); // seeded rows cannot be deleted
            $table->timestamps();

            $table->index(['country_id', 'is_active']);
            $table->index('display_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_governorates');
    }
};
