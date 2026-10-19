<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop FK constraint first (guard against missing), then the column
        if (Schema::hasColumn('warehouses', 'branch_id')) {
            try {
                Schema::table('warehouses', function ($table) {
                    $table->dropForeign('warehouses_branch_id_foreign');
                });
            } catch (Exception) {
                // FK doesn't exist — nothing to drop
            }
            Schema::table('warehouses', function ($table) {
                $table->dropColumn('branch_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('warehouses', function ($table) {
            $table->foreignUuid('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
        });
    }
};
