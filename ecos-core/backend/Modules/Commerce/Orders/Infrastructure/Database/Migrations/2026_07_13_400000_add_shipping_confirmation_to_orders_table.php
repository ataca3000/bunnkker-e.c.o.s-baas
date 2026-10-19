<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds operational shipping tracking fields and customer confirmation metadata.
 * Required by TASK-ORDER-WORKSPACE-FINAL-002.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            // Shipping logistics — carrier name, attempt counter, tracking
            if (! Schema::hasColumn('orders', 'shipping_company_name')) {
                $table->string('shipping_company_name')->nullable()->after('shipping_method');
            }
            if (! Schema::hasColumn('orders', 'shipping_attempts')) {
                $table->unsignedSmallInteger('shipping_attempts')->default(0)->after('shipping_company_name');
            }
            if (! Schema::hasColumn('orders', 'tracking_number')) {
                $table->string('tracking_number')->nullable()->after('shipping_attempts');
            }

            // GPS — who set the coordinates ('customer' or 'employee')
            if (! Schema::hasColumn('orders', 'location_set_by')) {
                $table->string('location_set_by', 20)->nullable()->after('tracking_number');
            }

            // Customer confirmation — CRM operator confirms the order with the customer
            if (! Schema::hasColumn('orders', 'customer_confirmed_at')) {
                $table->timestamp('customer_confirmed_at')->nullable()->after('location_set_by');
            }
            if (! Schema::hasColumn('orders', 'customer_confirmed_by')) {
                $table->string('customer_confirmed_by')->nullable()->after('customer_confirmed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $cols = ['shipping_company_name', 'shipping_attempts', 'tracking_number',
                'location_set_by', 'customer_confirmed_at', 'customer_confirmed_by'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('orders', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
