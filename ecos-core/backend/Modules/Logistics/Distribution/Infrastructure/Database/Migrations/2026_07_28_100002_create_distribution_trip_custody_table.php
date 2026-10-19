<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Equipment and cash float handed to the driver for a trip.
 * Consolidates the original create plus its driver-confirmation ALTER.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_trip_custody')) {
            return;
        }

        Schema::create('distribution_trip_custody', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('distribution_trips')->cascadeOnDelete();

            $table->string('item_type', 40);
            $table->string('description', 200)->nullable();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->text('notes')->nullable();

            // Driver confirmation at handover.
            $table->unsignedSmallInteger('received_quantity')->nullable();
            $table->boolean('is_driver_confirmed')->default(false);
            $table->timestamp('driver_confirmed_at')->nullable();
            $table->foreignId('driver_confirmed_by')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['trip_id', 'item_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_trip_custody');
    }
};
