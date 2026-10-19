<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_delivery_stops')) {
            return;
        }

        Schema::create('distribution_delivery_stops', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('trip_id')->constrained('distribution_trips')->cascadeOnDelete();

            $table->uuid('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();

            $table->unsignedInteger('sequence')->default(0);
            $table->string('status', 30)->default('pending');
            $table->string('delivery_type', 40)->nullable();
            $table->decimal('collected_amount', 12, 2)->default(0);
            $table->string('payment_method', 30)->nullable();

            $table->timestamp('attempted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->decimal('gps_lat', 10, 7)->nullable();
            $table->decimal('gps_lng', 10, 7)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            // A given order appears at most once in a trip's stop list.
            $table->unique(['trip_id', 'order_id'], 'distribution_stops_trip_order_unique');
            $table->index(['trip_id', 'sequence']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_delivery_stops');
    }
};
