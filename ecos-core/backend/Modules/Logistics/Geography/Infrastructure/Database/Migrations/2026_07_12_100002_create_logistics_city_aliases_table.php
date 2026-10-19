<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_city_aliases')) {
            return;
        }

        Schema::create('logistics_city_aliases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('city_id')
                ->constrained('logistics_cities')
                ->cascadeOnDelete();
            $table->string('provider', 50)->nullable(); // bosta, mylerz, smsa, aramex …
            $table->string('alias', 200);
            $table->string('code', 50)->nullable();
            $table->timestamps();

            $table->index('city_id');
            $table->index('provider');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_city_aliases');
    }
};
