<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One physical attempt, linked to the Distribution stop it was executed from.
 *
 * Retry is simply attempt N+1 on a later trip — which is why attempts live
 * here rather than in Distribution, whose stop cannot outlive its trip.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_attempts')) {
            return;
        }

        Schema::create('delivery_attempts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('delivery_id')->constrained('delivery_deliveries')->cascadeOnDelete();

            // Read-only reference into Distribution.
            $table->foreignId('stop_id')->nullable()
                ->constrained('distribution_delivery_stops')->nullOnDelete();
            $table->foreignId('trip_id')->nullable()
                ->constrained('distribution_trips')->nullOnDelete();

            $table->unsignedSmallInteger('attempt_no');
            $table->string('status', 30)->default('created');

            $table->timestamp('en_route_at')->nullable();
            $table->timestamp('arrived_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->decimal('gps_lat', 10, 7)->nullable();
            $table->decimal('gps_lng', 10, 7)->nullable();
            $table->unsignedSmallInteger('gps_accuracy_m')->nullable();

            $table->string('recipient_name', 150)->nullable();
            $table->string('recipient_relationship', 60)->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['delivery_id', 'attempt_no'], 'delivery_attempts_no_unique');
            $table->index(['delivery_id', 'status']);
            $table->index('stop_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_attempts');
    }
};
