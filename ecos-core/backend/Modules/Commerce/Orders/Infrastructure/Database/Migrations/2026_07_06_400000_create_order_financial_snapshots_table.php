<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_financial_snapshots')) {
            return;
        }

        Schema::create('order_financial_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('order_id')->unique();
            $table->uuid('company_id')->nullable();
            $table->uuid('brand_id')->nullable();
            $table->uuid('channel_id')->nullable();
            $table->string('channel_name')->nullable();
            $table->uuid('customer_id')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('currency', 10)->default('EGP');
            $table->string('payment_method')->nullable();
            $table->uuid('shipping_rule_id')->nullable();
            $table->decimal('subtotal', 12, 4)->default(0);
            $table->decimal('discount_amount', 12, 4)->default(0);
            $table->string('discount_type')->nullable();
            $table->decimal('shipping_cost', 12, 4)->default(0);
            $table->decimal('deposit_amount', 12, 4)->default(0);
            $table->decimal('remaining_balance', 12, 4)->default(0);
            $table->decimal('grand_total', 12, 4)->default(0);
            $table->uuid('snapshot_uuid');
            $table->tinyInteger('snapshot_version')->default(1);
            $table->uuid('created_by')->nullable();
            $table->string('pricing_engine_version', 20)->default('1.0.0');
            $table->string('cost_engine_version', 20)->default('1.0.0');
            $table->timestamps();

            $table->foreign('order_id')
                ->references('id')
                ->on('orders')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_financial_snapshots');
    }
};
