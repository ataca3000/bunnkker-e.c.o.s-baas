<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('bae_business_metrics')) {
            return;
        }

        Schema::create('bae_business_metrics', static function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // One metrics row per DNA — recalculated on each journey update
            $table->uuid('business_dna_id')->unique();
            $table->foreign('business_dna_id')
                ->references('id')->on('bae_business_dna')
                ->cascadeOnDelete();

            // Journey duration in seconds (nullable until each stage is reached)
            $table->unsignedBigInteger('time_to_first_contact_s')->nullable();
            $table->unsignedBigInteger('lead_to_quote_s')->nullable();
            $table->unsignedBigInteger('quote_to_order_s')->nullable();
            $table->unsignedBigInteger('order_to_payment_s')->nullable();
            $table->unsignedBigInteger('payment_to_preparation_s')->nullable();
            $table->unsignedBigInteger('preparation_to_packing_s')->nullable();
            $table->unsignedBigInteger('packing_to_shipment_s')->nullable();
            $table->unsignedBigInteger('shipment_to_delivery_s')->nullable();
            $table->unsignedBigInteger('delivery_to_repeat_s')->nullable();
            $table->unsignedBigInteger('customer_lifetime_duration_s')->nullable();
            $table->unsignedBigInteger('total_journey_time_s')->nullable();

            $table->timestamp('calculated_at')->useCurrent();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bae_business_metrics');
    }
};
