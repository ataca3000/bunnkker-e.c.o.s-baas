<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('waste_investigations', 'cost_snapshot_unit_cost')) {
            return;
        }

        Schema::table('waste_investigations', function (Blueprint $table) {
            // Immutable cost snapshot — set at resolution time from FIFO engine
            $table->decimal('cost_snapshot_unit_cost', 15, 4)->nullable()->after('total_cost');
            $table->decimal('cost_snapshot_total_value', 15, 2)->nullable()->after('cost_snapshot_unit_cost');
            $table->string('cost_method', 30)->nullable()->after('cost_snapshot_total_value'); // FIFO | AVERAGE | LAST_PURCHASE
            $table->char('currency', 3)->nullable()->default('EGP')->after('cost_method');
            $table->timestamp('cost_snapshot_at')->nullable()->after('currency');

            // Extension point for future integrations (Accounting, HR, Supplier Claims, AI)
            $table->json('metadata')->nullable()->after('cost_snapshot_at');

            // Traceability
            $table->string('created_by', 255)->nullable()->after('metadata');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('waste_investigations', 'cost_snapshot_unit_cost')) {
            return;
        }

        Schema::table('waste_investigations', function (Blueprint $table) {
            $table->dropColumn([
                'cost_snapshot_unit_cost',
                'cost_snapshot_total_value',
                'cost_method',
                'currency',
                'cost_snapshot_at',
                'metadata',
                'created_by',
            ]);
        });
    }
};
