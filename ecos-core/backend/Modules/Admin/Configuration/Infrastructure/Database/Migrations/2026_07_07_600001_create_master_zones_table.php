<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('master_zones')) {
            return;
        }

        Schema::create('master_zones', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('master_governorate_id')
                ->constrained('master_governorates')
                ->restrictOnDelete();
            $table->string('name', 150);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['master_governorate_id', 'name'], 'uq_mz_gov_name');
            $table->index('master_governorate_id', 'idx_mz_gov');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('master_zones');
    }
};
