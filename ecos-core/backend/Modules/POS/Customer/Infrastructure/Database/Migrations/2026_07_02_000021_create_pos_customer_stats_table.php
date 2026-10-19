<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_customer_stats')) {
            return;
        }

        Schema::create('pos_customer_stats', function (Blueprint $table): void {
            $table->uuid('customer_id')->primary();

            // Rolling totals — incremented atomically via PosCustomerListener
            $table->decimal('total_spent', 15, 4)->default(0);
            $table->unsignedInteger('order_count')->default(0);

            // Last-seen context — used as idempotency guard (ON CONFLICT WHERE IS DISTINCT FROM)
            $table->string('last_pos_sale_id', 36)->nullable();
            $table->timestampTz('last_purchase_at')->nullable();

            $table->timestampsTz();

            // No FK constraints — POS owns no cross-module schema per ADR-POS-001
            $table->index('last_purchase_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_customer_stats');
    }
};
