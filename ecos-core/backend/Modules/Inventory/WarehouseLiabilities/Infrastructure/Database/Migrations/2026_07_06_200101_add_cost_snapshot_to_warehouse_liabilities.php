<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('warehouse_liabilities', 'cost_snapshot_unit_cost')) {
            return;
        }

        Schema::table('warehouse_liabilities', function (Blueprint $table) {
            // Immutable cost snapshot — set at approval time from FIFO engine
            $table->decimal('cost_snapshot_unit_cost', 15, 4)->nullable()->after('total_cost');
            $table->decimal('cost_snapshot_total_value', 15, 2)->nullable()->after('cost_snapshot_unit_cost');
            $table->string('cost_method', 30)->nullable()->after('cost_snapshot_total_value'); // FIFO
            $table->char('currency', 3)->nullable()->default('EGP')->after('cost_method');

            // Extension point for future integrations (Accounting journal, HR payroll deductions, AI)
            $table->json('metadata')->nullable()->after('currency');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('warehouse_liabilities', 'cost_snapshot_unit_cost')) {
            return;
        }

        Schema::table('warehouse_liabilities', function (Blueprint $table) {
            $table->dropColumn([
                'cost_snapshot_unit_cost',
                'cost_snapshot_total_value',
                'cost_method',
                'currency',
                'metadata',
            ]);
        });
    }
};
