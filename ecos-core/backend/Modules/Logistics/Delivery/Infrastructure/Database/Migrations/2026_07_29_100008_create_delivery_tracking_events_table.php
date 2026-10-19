<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Append-only customer-visible event stream.
 *
 * `visibility` separates what operations sees from what the customer sees, so
 * one stream serves both the internal timeline and the public tracking page.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_tracking_events')) {
            return;
        }

        Schema::create('delivery_tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_id')->constrained('delivery_deliveries')->cascadeOnDelete();
            $table->foreignId('attempt_id')->nullable()
                ->constrained('delivery_attempts')->nullOnDelete();

            $table->string('event_type', 60);
            $table->string('visibility', 20)->default('internal'); // internal | customer
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();

            $table->decimal('gps_lat', 10, 7)->nullable();
            $table->decimal('gps_lng', 10, 7)->nullable();

            $table->string('actor_name', 150)->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['delivery_id', 'occurred_at']);
            $table->index(['delivery_id', 'visibility']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_tracking_events');
    }
};
