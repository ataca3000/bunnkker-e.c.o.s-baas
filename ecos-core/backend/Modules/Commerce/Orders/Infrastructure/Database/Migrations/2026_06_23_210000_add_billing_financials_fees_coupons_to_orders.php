<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('billing_company')->nullable()->after('billing_last_name');
            $table->string('billing_country', 10)->nullable()->after('billing_company');
            $table->string('billing_state')->nullable()->after('billing_country');
            $table->string('billing_city')->nullable()->after('billing_state');
            $table->string('billing_address_1')->nullable()->after('billing_city');
            $table->string('billing_address_2')->nullable()->after('billing_address_1');
            $table->string('billing_postcode', 20)->nullable()->after('billing_address_2');
            $table->string('billing_phone', 30)->nullable()->after('billing_postcode');
            $table->string('billing_email')->nullable()->after('billing_phone');
            $table->decimal('tax_total', 12, 2)->default(0)->after('discount_total');
        });

        if (Schema::hasTable('order_fees')) {
            return;
        }

        Schema::create('order_fees', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('name');
            $table->decimal('total', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('order_coupons', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('code');
            $table->decimal('discount', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_coupons');
        Schema::dropIfExists('order_fees');

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn([
                'billing_company',
                'billing_country',
                'billing_state',
                'billing_city',
                'billing_address_1',
                'billing_address_2',
                'billing_postcode',
                'billing_phone',
                'billing_email',
                'tax_total',
            ]);
        });
    }
};
