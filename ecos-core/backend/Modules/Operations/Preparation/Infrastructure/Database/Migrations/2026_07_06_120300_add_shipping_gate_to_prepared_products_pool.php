<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('prepared_products_pool', 'shipping_gate_opened')) {
            return;
        }

        Schema::table('prepared_products_pool', function (Blueprint $table): void {
            // false = gate closed (session not yet approved)
            // true  = gate open (session approved, Loading OS may consume)
            $table->boolean('shipping_gate_opened')->default(false)->after('quality_checked_at');
            $table->uuid('gate_opened_by')->nullable()->after('shipping_gate_opened');
            $table->timestampTz('gate_opened_at')->nullable()->after('gate_opened_by');
        });

        // All existing pool entries pre-date session approval gates.
        // Open their gate unconditionally so Loading OS is unaffected (backward compat).
        DB::statement('UPDATE prepared_products_pool SET shipping_gate_opened = true');

        DB::statement(
            'ALTER TABLE prepared_products_pool ADD INDEX idx_pool_shipping_gate (shipping_gate_opened)',
        );
    }

    public function down(): void
    {
        if (Schema::hasColumn('prepared_products_pool', 'shipping_gate_opened')) {
            return;
        }

        Schema::table('prepared_products_pool', function (Blueprint $table): void {
            $table->dropColumn(['shipping_gate_opened', 'gate_opened_by', 'gate_opened_at']);
        });
    }
};
