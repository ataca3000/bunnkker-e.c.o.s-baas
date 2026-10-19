<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add customer snapshot columns to the orders table.
 *
 * An order is a historical business document. These three fields capture the
 * customer's name, secondary phone, and notes at the moment the order is
 * created (or last edited). They must never be read from the Customer record
 * at display time — the Customer record is for CRM purposes only.
 *
 * billing_phone already serves as the primary-phone snapshot.
 * billing_email already serves as the email snapshot.
 * governorate/city/area/shipping_address etc. already snapshot the address.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // customer_name already exists (added by an earlier migration).
            $table->string('customer_secondary_phone', 50)->nullable()->after('billing_phone');
            $table->text('customer_notes')->nullable()->after('notes');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['customer_secondary_phone', 'customer_notes']);
        });
    }
};
