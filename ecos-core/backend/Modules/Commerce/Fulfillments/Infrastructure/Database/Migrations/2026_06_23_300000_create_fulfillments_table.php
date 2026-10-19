<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('fulfillments')) {
            return;
        }

        Schema::create('fulfillments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('fulfillment_number')->unique();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->constrained()->restrictOnDelete();
            $table->date('fulfillment_date');
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fulfillments');
    }
};
