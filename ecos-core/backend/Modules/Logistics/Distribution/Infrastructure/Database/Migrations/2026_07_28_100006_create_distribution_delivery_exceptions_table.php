<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_delivery_exceptions')) {
            return;
        }

        Schema::create('distribution_delivery_exceptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('distribution_trips')->cascadeOnDelete();
            $table->foreignId('stop_id')->nullable()
                ->constrained('distribution_delivery_stops')->nullOnDelete();

            $table->uuid('order_id')->nullable();
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();

            $table->string('exception_type', 50);
            $table->text('description');
            $table->json('photos')->nullable();

            // Set once the exception has been pushed to customer service.
            $table->boolean('synced_to_cs')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('resolution_notes')->nullable();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['trip_id', 'exception_type']);
            $table->index('synced_to_cs');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_delivery_exceptions');
    }
};
