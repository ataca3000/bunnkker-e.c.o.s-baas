<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * COD completion at the door.
 *
 * CTO decision 3 — Distribution is the SINGLE CASH AUTHORITY. This table
 * records that money changed hands and drives the CodCollected event. It
 * never computes a settlement, and nothing here writes to
 * distribution_payment_collections or distribution_trip_settlements.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_cod_records')) {
            return;
        }

        Schema::create('delivery_cod_records', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('delivery_id')->constrained('delivery_deliveries')->cascadeOnDelete();
            $table->foreignId('attempt_id')->nullable()
                ->constrained('delivery_attempts')->cascadeOnDelete();

            $table->string('status', 20)->default('due');
            $table->decimal('amount_due', 12, 2)->default(0);
            $table->decimal('amount_collected', 12, 2)->default(0);
            $table->string('currency', 3)->default('EGP');
            $table->string('method', 30)->nullable(); // cash | card | bank_transfer
            $table->string('reference_number', 100)->nullable();

            $table->timestamp('collected_at')->nullable();
            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('dispute_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['delivery_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_cod_records');
    }
};
