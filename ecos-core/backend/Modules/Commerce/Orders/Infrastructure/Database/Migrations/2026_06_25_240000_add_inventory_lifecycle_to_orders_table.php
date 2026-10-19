<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'inventory_reserved_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('inventory_reserved_at')->nullable()->after('status');
            $table->timestamp('inventory_shipped_at')->nullable()->after('inventory_reserved_at');
            $table->timestamp('inventory_released_at')->nullable()->after('inventory_shipped_at');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'inventory_reserved_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['inventory_reserved_at', 'inventory_shipped_at', 'inventory_released_at']);
        });
    }
};
