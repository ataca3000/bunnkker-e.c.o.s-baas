<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Money taken at a stop. Feeds the trip settlement totals. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_payment_collections')) {
            return;
        }

        Schema::create('distribution_payment_collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('distribution_trips')->cascadeOnDelete();
            $table->foreignId('stop_id')->nullable()
                ->constrained('distribution_delivery_stops')->cascadeOnDelete();

            $table->string('payment_type', 20); // cash | bank_transfer | card | already_paid
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('reference_number', 100)->nullable();
            $table->string('image_path', 500)->nullable();
            $table->text('notes')->nullable();

            $table->string('status', 20)->default('recorded'); // recorded | verified | rejected
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('collected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['trip_id', 'payment_type']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_payment_collections');
    }
};
