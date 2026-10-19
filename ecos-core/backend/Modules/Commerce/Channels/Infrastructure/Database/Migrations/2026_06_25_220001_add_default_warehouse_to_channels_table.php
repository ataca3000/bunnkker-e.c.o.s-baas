<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channels', function (Blueprint $table): void {
            $table->foreignUuid('default_warehouse_id')
                ->nullable()
                ->after('company_id')
                ->constrained('warehouses')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('channels', function (Blueprint $table): void {
            $table->dropForeignIdFor(Modules\MasterData\Warehouses\Domain\Models\Warehouse::class, 'default_warehouse_id');
            $table->dropColumn('default_warehouse_id');
        });
    }
};
