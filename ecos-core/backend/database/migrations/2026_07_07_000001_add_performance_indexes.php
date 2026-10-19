<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * TASK-PATCH-001 Fix 2 — Add missing performance indexes identified during CTO review.
 *
 * Each index targets a specific hot query path:
 *  - inventory_receipt_layers [product_id, warehouse_id]  → FIFO cost lookup in posting services
 *  - goods_receipt_lines      [goods_receipt_id, product_id] → line lookups during GR post
 *  - purchase_order_lines     [purchase_order_id, product_id] → over-receipt checks
 *  - supplier_invoice_lines   [supplier_invoice_id, product_id] → landed-cost allocation loop
 *  - products                 [product_type, is_active] → catalog filter combos
 *  - inventory_items          [company_id, warehouse_id] → multi-warehouse stock rollups
 *  - purchase_materials       [assigned_buyer, status] → buyer workload dashboards
 *  - goods_receipts           [warehouse_id, status] → receiving-center list
 *  - supplier_invoices        [warehouse_id, status] → AP reconciliation list
 */
return new class extends Migration
{
    public function up(): void
    {
        // Critical: FIFO layer lookup used on every invoice/GR posting
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->index(['product_id', 'warehouse_id'], 'irl_product_warehouse_idx');
        });

        // GR posting: line-level product lookups
        Schema::table('goods_receipt_lines', function (Blueprint $table): void {
            $table->index(['goods_receipt_id', 'product_id'], 'grl_receipt_product_idx');
        });

        // Over-receipt check: PO line lookups by PO + product
        Schema::table('purchase_order_lines', function (Blueprint $table): void {
            $table->index(['purchase_order_id', 'product_id'], 'pol_po_product_idx');
        });

        // Invoice posting: line-level product lookups
        Schema::table('supplier_invoice_lines', function (Blueprint $table): void {
            $table->index(['supplier_invoice_id', 'product_id'], 'sil_invoice_product_idx');
        });

        // Product catalog: common combined filter
        Schema::table('products', function (Blueprint $table): void {
            $table->index(['product_type', 'is_active'], 'products_type_active_idx');
        });

        // Inventory rollups by company + warehouse
        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->index(['company_id', 'warehouse_id'], 'inv_items_company_warehouse_idx');
        });

        // Procurement dashboards: buyer workload and warehouse-level views
        Schema::table('purchase_materials', function (Blueprint $table): void {
            $table->index(['assigned_buyer', 'status'], 'pm_buyer_status_idx');
        });

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->index(['warehouse_id', 'status'], 'gr_warehouse_status_idx');
        });

        Schema::table('supplier_invoices', function (Blueprint $table): void {
            $table->index(['warehouse_id', 'status'], 'si_warehouse_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_receipt_layers', function (Blueprint $table): void {
            $table->dropIndex('irl_product_warehouse_idx');
        });

        Schema::table('goods_receipt_lines', function (Blueprint $table): void {
            $table->dropIndex('grl_receipt_product_idx');
        });

        Schema::table('purchase_order_lines', function (Blueprint $table): void {
            $table->dropIndex('pol_po_product_idx');
        });

        Schema::table('supplier_invoice_lines', function (Blueprint $table): void {
            $table->dropIndex('sil_invoice_product_idx');
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropIndex('products_type_active_idx');
        });

        Schema::table('inventory_items', function (Blueprint $table): void {
            $table->dropIndex('inv_items_company_warehouse_idx');
        });

        Schema::table('purchase_materials', function (Blueprint $table): void {
            $table->dropIndex('pm_buyer_status_idx');
        });

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->dropIndex('gr_warehouse_status_idx');
        });

        Schema::table('supplier_invoices', function (Blueprint $table): void {
            $table->dropIndex('si_warehouse_status_idx');
        });
    }
};
