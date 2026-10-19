<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_lines', 'reserved_qty')) {
            return;
        }

        Schema::table('order_lines', function (Blueprint $table) {
            $table->float('reserved_qty')->default(0)->after('line_total');
            $table->float('available_qty')->default(0)->after('reserved_qty');
            $table->float('prepared_qty')->default(0)->after('available_qty');
            $table->float('packed_qty')->default(0)->after('prepared_qty');
            $table->float('loaded_qty')->default(0)->after('packed_qty');
            $table->float('delivered_qty')->default(0)->after('loaded_qty');
            $table->float('returned_qty')->default(0)->after('delivered_qty');
            $table->float('cancelled_qty')->default(0)->after('returned_qty');
            $table->string('warehouse_name')->nullable()->after('cancelled_qty');
            $table->string('batch_number')->nullable()->after('warehouse_name');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_lines', 'reserved_qty')) {
            return;
        }

        Schema::table('order_lines', function (Blueprint $table) {
            $table->dropColumn([
                'reserved_qty', 'available_qty', 'prepared_qty', 'packed_qty',
                'loaded_qty', 'delivered_qty', 'returned_qty', 'cancelled_qty',
                'warehouse_name', 'batch_number',
            ]);
        });
    }
};
