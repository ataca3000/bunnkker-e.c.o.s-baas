<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'bom_version_number')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            // Integer version counter for copy-on-write versioning (RC-10 architecture).
            // Monotonically increasing per product. Idempotency enforced at the application layer.
            $table->unsignedInteger('bom_version_number')->default(1);

            $table->index(['product_id', 'bom_version_number'], 'idx_bom_product_version');
        });

        // Backfill all existing rows — they were all created before versioning existed, so version 1.
        DB::table('bills_of_materials')->whereNull('deleted_at')->update(['bom_version_number' => 1]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('bills_of_materials', 'bom_version_number')) {
            return;
        }

        Schema::table('bills_of_materials', function (Blueprint $table): void {
            $table->dropIndex('idx_bom_product_version');
            $table->dropColumn('bom_version_number');
        });
    }
};
