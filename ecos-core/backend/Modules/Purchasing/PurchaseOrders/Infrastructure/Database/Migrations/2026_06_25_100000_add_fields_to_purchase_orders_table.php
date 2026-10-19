<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('purchase_orders', 'company_id')) {
            return;
        }

        Schema::table('purchase_orders', function (Blueprint $table): void {
            // Multi-tenancy
            $table->foreignUuid('company_id')->nullable()->after('id')->constrained('companies')->restrictOnDelete();
            // Default receiving warehouse (optional — overridable per GR)
            $table->foreignUuid('warehouse_id')->nullable()->after('company_id')->constrained('warehouses')->restrictOnDelete();
            // Supplier's own PO reference
            $table->string('supplier_reference')->nullable()->after('supplier_id');
            // Financial breakdown
            $table->decimal('discount_amount', 15, 2)->default(0)->after('subtotal');
            $table->decimal('shipping_amount', 15, 2)->default(0)->after('discount_amount');
            $table->decimal('additional_costs', 15, 2)->default(0)->after('shipping_amount');
            $table->decimal('grand_total', 15, 2)->default(0)->after('additional_costs');
            // Approval audit
            $table->string('approved_by')->nullable()->after('notes');
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            // Change tracking
            $table->string('created_by')->nullable()->after('approved_at');
            $table->string('updated_by')->nullable()->after('created_by');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchase_orders', 'company_id')) {
            return;
        }

        Schema::table('purchase_orders', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropForeign(['warehouse_id']);
            $table->dropColumn([
                'company_id', 'warehouse_id', 'supplier_reference',
                'discount_amount', 'shipping_amount', 'additional_costs', 'grand_total',
                'approved_by', 'approved_at', 'created_by', 'updated_by',
            ]);
        });
    }
};
