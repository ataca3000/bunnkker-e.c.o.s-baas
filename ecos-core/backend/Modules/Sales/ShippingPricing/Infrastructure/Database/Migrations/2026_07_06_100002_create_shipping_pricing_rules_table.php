<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('shipping_pricing_rules')) {
            return;
        }

        Schema::create('shipping_pricing_rules', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('governorate', 100);
            $table->string('city', 100)->nullable();
            $table->string('area', 100)->nullable();
            $table->decimal('standard_cost', 10, 2)->default(0);
            $table->decimal('express_cost', 10, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['company_id', 'governorate']);
            $table->index(['company_id', 'governorate', 'city']);
            $table->index(['company_id', 'governorate', 'city', 'area']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_pricing_rules');
    }
};
