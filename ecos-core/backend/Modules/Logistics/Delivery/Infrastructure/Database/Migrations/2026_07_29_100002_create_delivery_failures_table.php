<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Structured failure record — immutable once written. One per failed attempt. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_failures')) {
            return;
        }

        Schema::create('delivery_failures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_id')->constrained('delivery_deliveries')->cascadeOnDelete();
            $table->foreignId('attempt_id')->constrained('delivery_attempts')->cascadeOnDelete();

            $table->string('reason_code', 50);
            $table->string('category', 30);
            $table->boolean('is_retryable');
            $table->boolean('requires_address_correction')->default(false);
            $table->text('description')->nullable();
            $table->json('photos')->nullable();

            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('attempt_id', 'delivery_failures_attempt_unique');
            $table->index(['delivery_id', 'category']);
            $table->index('reason_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_failures');
    }
};
