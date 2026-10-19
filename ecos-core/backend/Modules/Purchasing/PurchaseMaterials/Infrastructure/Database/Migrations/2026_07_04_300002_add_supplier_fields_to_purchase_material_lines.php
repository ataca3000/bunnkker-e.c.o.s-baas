<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('purchase_material_lines', 'supplier_id')) {
            return;
        }

        Schema::table('purchase_material_lines', function (Blueprint $table): void {
            // Supplier selection (set by Procurement team, never by Warehouse)
            $table->uuid('supplier_id')->nullable()->after('notes')
                ->constrained('suppliers')->nullOnDelete();
            $table->decimal('agreed_price', 15, 4)->nullable()->after('supplier_id');
            $table->decimal('agreed_qty', 15, 4)->nullable()->after('agreed_price');
            $table->unsignedInteger('lead_time_days')->nullable()->after('agreed_qty');
            $table->timestamp('supplier_selected_at')->nullable()->after('lead_time_days');
            $table->uuid('supplier_selected_by')->nullable()->after('supplier_selected_at');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_material_lines', 'supplier_id')) {
            return;
        }

        Schema::table('purchase_material_lines', function (Blueprint $table): void {
            $table->dropForeign(['supplier_id']);
            $table->dropColumn([
                'supplier_id', 'agreed_price', 'agreed_qty',
                'lead_time_days', 'supplier_selected_at', 'supplier_selected_by',
            ]);
        });
    }
};
