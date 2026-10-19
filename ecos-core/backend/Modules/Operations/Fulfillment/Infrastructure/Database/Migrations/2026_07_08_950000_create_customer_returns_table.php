<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('customer_returns')) {
            return;
        }

        Schema::create('customer_returns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable()->index();
            $table->uuid('order_id')->index();
            $table->string('return_number', 30)->unique();
            $table->string('status', 30)->default('pending_inspection')->index();
            $table->string('return_reason', 100);
            $table->text('driver_notes')->nullable();
            $table->text('warehouse_notes')->nullable();
            $table->string('inspector_id', 36)->nullable();
            $table->timestamp('inspected_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('inventory_restored_at')->nullable();
            $table->string('recorded_by', 36);
            $table->timestamps();

            $table->foreign('order_id')->references('id')->on('orders')->onDelete('restrict');
            $table->index(['company_id', 'status']);
            $table->index(['order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_returns');
    }
};
