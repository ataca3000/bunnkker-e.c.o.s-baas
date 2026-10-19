<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('master_governorates')) {
            return;
        }

        Schema::create('master_governorates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 150)->unique();
            $table->string('name_ar', 150)->nullable();
            $table->string('code', 10)->unique();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('master_governorates');
    }
};
