<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customer-facing return, owned by Delivery OS (CTO decision 2).
 *
 * Distribution's TripReturn records what physically came back on the vehicle.
 * This records what the CUSTOMER did not accept, why, and how the warehouse
 * reconciled it line by line.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_returns')) {
            return;
        }

        Schema::create('delivery_returns', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('delivery_id')->constrained('delivery_deliveries')->cascadeOnDelete();
            $table->foreignId('attempt_id')->nullable()
                ->constrained('delivery_attempts')->nullOnDelete();

            $table->string('status', 30)->default('initiated');
            $table->string('reason_code', 50)->nullable();
            $table->text('reason')->nullable();

            $table->timestamp('initiated_at')->nullable();
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();

            $table->boolean('has_discrepancy')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['delivery_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_returns');
    }
};
