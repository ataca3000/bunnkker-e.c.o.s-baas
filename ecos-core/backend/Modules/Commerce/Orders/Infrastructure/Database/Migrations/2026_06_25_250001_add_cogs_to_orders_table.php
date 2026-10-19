<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'actual_cogs_amount')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('actual_cogs_amount', 15, 2)->nullable()->after('inventory_released_at');
            $table->decimal('actual_margin_amount', 15, 2)->nullable()->after('actual_cogs_amount');
            $table->decimal('actual_margin_percent', 8, 2)->nullable()->after('actual_margin_amount');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'actual_cogs_amount')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['actual_cogs_amount', 'actual_margin_amount', 'actual_margin_percent']);
        });
    }
};
