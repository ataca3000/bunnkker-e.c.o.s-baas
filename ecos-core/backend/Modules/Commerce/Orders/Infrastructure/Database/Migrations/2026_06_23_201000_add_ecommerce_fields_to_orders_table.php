<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'billing_first_name')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            // Billing name
            $table->string('billing_first_name')->nullable()->after('notes');
            $table->string('billing_last_name')->nullable()->after('billing_first_name');

            // Shipping address
            $table->string('shipping_first_name')->nullable()->after('billing_last_name');
            $table->string('shipping_last_name')->nullable()->after('shipping_first_name');
            $table->string('shipping_company')->nullable()->after('shipping_last_name');
            $table->string('shipping_country', 10)->nullable()->after('shipping_company');
            $table->string('shipping_state')->nullable()->after('shipping_country');
            $table->string('shipping_city')->nullable()->after('shipping_state');
            $table->string('shipping_address_1')->nullable()->after('shipping_city');
            $table->string('shipping_address_2')->nullable()->after('shipping_address_1');
            $table->string('shipping_postcode', 20)->nullable()->after('shipping_address_2');

            // Customer note (raw note from buyer)
            $table->text('customer_note')->nullable()->after('shipping_postcode');

            // Payment
            $table->string('payment_method')->nullable()->after('customer_note');
            $table->string('payment_method_title')->nullable()->after('payment_method');
            $table->string('transaction_id')->nullable()->after('payment_method_title');
            $table->dateTime('date_paid')->nullable()->after('transaction_id');

            // Shipping details
            $table->string('shipping_method')->nullable()->after('date_paid');
            $table->decimal('shipping_total', 12, 2)->default(0)->after('shipping_method');

            // Discounts
            $table->decimal('discount_total', 12, 2)->default(0)->after('shipping_total');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'billing_first_name')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn([
                'billing_first_name',
                'billing_last_name',
                'shipping_first_name',
                'shipping_last_name',
                'shipping_company',
                'shipping_country',
                'shipping_state',
                'shipping_city',
                'shipping_address_1',
                'shipping_address_2',
                'shipping_postcode',
                'customer_note',
                'payment_method',
                'payment_method_title',
                'transaction_id',
                'date_paid',
                'shipping_method',
                'shipping_total',
                'discount_total',
            ]);
        });
    }
};
