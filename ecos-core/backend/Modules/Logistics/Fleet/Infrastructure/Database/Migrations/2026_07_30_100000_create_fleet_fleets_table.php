<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fleet — an ownership / operating-model boundary.
 *
 * Purely organisational: holds no vehicle attribute. `shipping_company_id` is
 * nullable and distinguishes an own fleet from a carrier's fleet, referencing
 * LOG-001 rather than duplicating it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fleet_fleets', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            // Null = own fleet. Set = a carrier's fleet (LOG-001, by reference).
            $table->unsignedBigInteger('shipping_company_id')->nullable();
            $table->foreign('shipping_company_id')
                ->references('id')->on('logistics_shipping_companies')->nullOnDelete();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'fleet_fleets_company_code_unique');
            $table->index(['company_id', 'is_active'], 'fleet_fleets_company_active_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fleet_fleets');
    }
};
