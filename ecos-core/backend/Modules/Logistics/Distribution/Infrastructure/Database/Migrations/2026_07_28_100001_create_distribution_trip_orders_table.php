<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_trip_orders')) {
            return;
        }

        Schema::create('distribution_trip_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('distribution_trips')->cascadeOnDelete();

            // orders.id is a UUID — the previous schema declared this both ways.
            $table->uuid('order_id');
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();

            // Snapshots so a trip manifest stays readable even if the order's
            // zone is later re-assigned.
            $table->string('zone_code_snapshot', 30)->nullable();
            $table->string('governorate_snapshot', 100)->nullable();

            $table->string('assignment_type', 20)->default('auto'); // auto | manual
            $table->foreignId('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();

            // An order may belong to at most one trip.
            $table->unique('order_id', 'distribution_trip_orders_order_unique');
            $table->index('trip_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_trip_orders');
    }
};
