<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'requested_delivery_date')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->date('requested_delivery_date')->nullable()->after('order_date');
            $table->string('preferred_delivery_time')->nullable()->after('requested_delivery_date');
            $table->string('payment_method_manual')->nullable()->after('preferred_delivery_time');
            $table->string('payment_proof_path')->nullable()->after('payment_method_manual');
            $table->string('governorate')->nullable()->after('payment_proof_path');
            $table->string('area')->nullable()->after('governorate');
            $table->decimal('shipping_cost', 10, 2)->nullable()->after('area');
            $table->string('shipping_cost_source')->nullable()->after('shipping_cost');
            $table->decimal('discount_amount', 10, 2)->default(0)->after('shipping_cost_source');
            $table->string('discount_type')->nullable()->after('discount_amount');
            $table->decimal('deposit_amount', 10, 2)->default(0)->after('discount_type');
            $table->decimal('remaining_balance', 10, 2)->default(0)->after('deposit_amount');

            $table->index('governorate');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex(['governorate']);
            $table->dropColumn([
                'requested_delivery_date',
                'preferred_delivery_time',
                'payment_method_manual',
                'payment_proof_path',
                'governorate',
                'area',
                'shipping_cost',
                'shipping_cost_source',
                'discount_amount',
                'discount_type',
                'deposit_amount',
                'remaining_balance',
            ]);
        });
    }
};
