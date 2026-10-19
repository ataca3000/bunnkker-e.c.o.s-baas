<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Append-only log of what the driver did at a stop. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_delivery_actions')) {
            return;
        }

        Schema::create('distribution_delivery_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stop_id')->constrained('distribution_delivery_stops')->cascadeOnDelete();

            $table->string('action_type', 40);
            $table->string('reason', 255)->nullable();
            $table->text('notes')->nullable();
            $table->date('new_delivery_date')->nullable();
            $table->decimal('corrected_lat', 10, 7)->nullable();
            $table->decimal('corrected_lng', 10, 7)->nullable();

            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['stop_id', 'action_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_delivery_actions');
    }
};
