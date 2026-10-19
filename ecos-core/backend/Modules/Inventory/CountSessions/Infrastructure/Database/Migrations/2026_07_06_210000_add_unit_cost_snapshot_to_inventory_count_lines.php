<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('inventory_count_lines', 'unit_cost_snapshot')) {
            return;
        }

        Schema::table('inventory_count_lines', function (Blueprint $table) {
            // Frozen unit cost captured at approval time — used for report financial accuracy
            $table->decimal('unit_cost_snapshot', 15, 4)->nullable()->after('variance_value');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('inventory_count_lines', 'unit_cost_snapshot')) {
            return;
        }

        Schema::table('inventory_count_lines', function (Blueprint $table) {
            $table->dropColumn('unit_cost_snapshot');
        });
    }
};
