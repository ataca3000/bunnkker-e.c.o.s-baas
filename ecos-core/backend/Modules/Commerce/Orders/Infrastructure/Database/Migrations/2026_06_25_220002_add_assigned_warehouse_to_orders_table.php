<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'assigned_warehouse_id')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignUuid('assigned_warehouse_id')
                ->nullable()
                ->after('channel_id')
                ->constrained('warehouses')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'assigned_warehouse_id')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropForeignIdFor(Modules\MasterData\Warehouses\Domain\Models\Warehouse::class, 'assigned_warehouse_id');
            $table->dropColumn('assigned_warehouse_id');
        });
    }
};
