<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * End-of-trip cash reconciliation. One settlement per trip.
 *
 * cash_expected is derived from the payment collections of type `cash`;
 * discrepancy = driver_cash_submitted - cash_expected.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_trip_settlements')) {
            return;
        }

        Schema::create('distribution_trip_settlements', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('trip_id')->constrained('distribution_trips')->cascadeOnDelete();

            $table->decimal('cash_collected', 12, 2)->default(0);
            $table->decimal('bank_transfers_pending', 12, 2)->default(0);
            $table->decimal('already_paid', 12, 2)->default(0);
            $table->decimal('total_collected', 12, 2)->default(0);

            $table->decimal('cash_expected', 12, 2)->default(0);
            $table->decimal('driver_cash_submitted', 12, 2)->nullable();
            $table->decimal('discrepancy', 12, 2)->nullable();

            $table->string('status', 20)->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamp('finalized_at')->nullable();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            // One settlement per trip.
            $table->unique('trip_id', 'distribution_settlements_trip_unique');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_trip_settlements');
    }
};
