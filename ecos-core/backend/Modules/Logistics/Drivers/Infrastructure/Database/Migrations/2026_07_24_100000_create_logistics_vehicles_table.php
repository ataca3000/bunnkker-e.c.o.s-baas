<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Minimal vehicle registry.
 *
 * TASK-LOG-002 requires driver→vehicle assignment, which needs a vehicle to
 * point at. This table is deliberately the smallest thing that satisfies that
 * requirement (identity, class, availability) and is designed to be EXTENDED by
 * the future Vehicles module (TASK-LOG-003) rather than replaced — new columns
 * such as ownership, insurance, odometer and maintenance belong there.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_vehicles')) {
            return;
        }

        Schema::create('logistics_vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('plate_number', 30)->unique();
            $table->string('type', 20)->default('van'); // van | truck | motorcycle | pickup | car
            $table->string('make', 50)->nullable();
            $table->string('model', 50)->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->unsignedSmallInteger('capacity_orders')->default(60);

            // A vehicle may belong to a carrier (typically the internal fleet).
            $table->foreignId('shipping_company_id')
                ->nullable()
                ->constrained('logistics_shipping_companies')
                ->nullOnDelete();

            $table->string('status', 20)->default('active'); // active | inactive | archived
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_vehicles');
    }
};
