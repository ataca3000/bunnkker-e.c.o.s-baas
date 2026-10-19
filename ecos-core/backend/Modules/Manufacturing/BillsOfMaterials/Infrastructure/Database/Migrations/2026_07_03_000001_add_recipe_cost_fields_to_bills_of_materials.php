<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'manufacturing_cost')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->decimal('manufacturing_cost', 12, 2)->default(0)->after('notes');
            $table->decimal('other_costs', 12, 2)->default(0)->after('manufacturing_cost');
            $table->text('execution_instructions')->nullable()->after('other_costs');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'manufacturing_cost')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->dropColumn(['manufacturing_cost', 'other_costs', 'execution_instructions']);
        });
    }
};
