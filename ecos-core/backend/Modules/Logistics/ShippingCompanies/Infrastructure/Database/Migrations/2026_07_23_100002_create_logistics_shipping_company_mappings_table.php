<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_shipping_company_mappings')) {
            return;
        }

        Schema::create('logistics_shipping_company_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shipping_company_id')
                ->constrained('logistics_shipping_companies')
                ->cascadeOnDelete();
            $table->uuid('company_id');
            $table->timestamps();

            $table->unique(['shipping_company_id', 'company_id'], 'shipping_company_company_unique');
            $table->index('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_shipping_company_mappings');
    }
};
