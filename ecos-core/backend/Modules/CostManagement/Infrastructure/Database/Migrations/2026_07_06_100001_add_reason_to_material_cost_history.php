<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('material_cost_history', 'reason')) {
            return;
        }

        Schema::table('material_cost_history', function (Blueprint $table): void {
            $table->string('reason', 500)->nullable()->after('updated_by');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('material_cost_history', 'reason')) {
            return;
        }

        Schema::table('material_cost_history', function (Blueprint $table): void {
            $table->dropColumn('reason');
        });
    }
};
