<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-UI-PROCUREMENT-002 — Supplier Location (Part 1) + Opening Balance (Part 2).
 *
 * Additive, nullable/defaulted columns only. country/city/address already exist;
 * this adds the missing location granularity plus the onboarding opening balance
 * so companies already trading before ECOS can carry a starting supplier balance.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table): void {
            if (! Schema::hasColumn('suppliers', 'state')) {
                $table->string('state')->nullable()->after('country');          // State / Governorate
            }
            if (! Schema::hasColumn('suppliers', 'district')) {
                $table->string('district')->nullable()->after('city');           // District / Area
            }
            if (! Schema::hasColumn('suppliers', 'google_maps_url')) {
                $table->string('google_maps_url', 1000)->nullable()->after('address');
            }
            if (! Schema::hasColumn('suppliers', 'opening_balance_amount')) {
                $table->decimal('opening_balance_amount', 15, 2)->default(0)->after('google_maps_url');
            }
            if (! Schema::hasColumn('suppliers', 'opening_balance_type')) {
                $table->string('opening_balance_type', 10)->default('credit')->after('opening_balance_amount'); // debit|credit
            }
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table): void {
            foreach (['state', 'district', 'google_maps_url', 'opening_balance_amount', 'opening_balance_type'] as $col) {
                if (Schema::hasColumn('suppliers', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
