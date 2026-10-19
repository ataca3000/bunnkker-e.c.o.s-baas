<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('inventory_count_lines', 'damaged_qty')) {
            return;
        }

        Schema::table('inventory_count_lines', function (Blueprint $table) {
            $table->decimal('damaged_qty', 15, 4)->nullable()->default(0)->after('counted_qty');
            $table->string('damage_reason', 100)->nullable()->after('damaged_qty');
            $table->decimal('shortage_qty', 15, 4)->nullable()->after('damage_reason');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('inventory_count_lines', 'damaged_qty')) {
            return;
        }

        Schema::table('inventory_count_lines', function (Blueprint $table) {
            $table->dropColumn(['damaged_qty', 'damage_reason', 'shortage_qty']);
        });
    }
};
