<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_plans', function (Blueprint $table): void {
            $table->index('company_id', 'idx_vehicle_plans_company_id');
            $table->index(['company_id', 'status'], 'idx_vehicle_plans_company_status');
            $table->index(['company_id', 'operational_date'], 'idx_vehicle_plans_company_date');
            $table->index('shipping_company_id', 'idx_vehicle_plans_shipping_company_id');
            $table->index('zone_id', 'idx_vehicle_plans_zone_id');
        });

        Schema::table('vehicle_plan_slots', function (Blueprint $table): void {
            $table->index('vehicle_plan_id', 'idx_plan_slots_vehicle_plan_id');
            $table->index(['vehicle_plan_id', 'status'], 'idx_plan_slots_plan_status');
        });

        Schema::table('vehicle_plan_slot_orders', function (Blueprint $table): void {
            $table->index('vehicle_plan_slot_id', 'idx_plan_slot_orders_slot_id');
            $table->index('vehicle_plan_id', 'idx_plan_slot_orders_plan_id');
            $table->index('order_id', 'idx_plan_slot_orders_order_id');
        });

        Schema::table('vehicle_plan_adjustment_log', function (Blueprint $table): void {
            $table->index('vehicle_plan_id', 'idx_plan_adj_log_vehicle_plan_id');
            $table->index('actor_id', 'idx_plan_adj_log_actor_id');
        });

        Schema::table('loading_sessions', function (Blueprint $table): void {
            $table->index('company_id', 'idx_loading_sessions_company_id');
            $table->index(['company_id', 'status'], 'idx_loading_sessions_company_status');
            $table->index(['company_id', 'operational_date'], 'idx_loading_sessions_company_date');
            $table->index('warehouse_id', 'idx_loading_sessions_warehouse_id');
        });

        Schema::table('vehicle_assignments', function (Blueprint $table): void {
            $table->index('loading_session_id', 'idx_vehicle_assignments_loading_session_id');
            $table->index('vehicle_id', 'idx_vehicle_assignments_vehicle_id');
            $table->index(['company_id', 'status'], 'idx_vehicle_assignments_company_status');
        });

        Schema::table('loading_exceptions', function (Blueprint $table): void {
            $table->index('loading_session_id', 'idx_loading_exceptions_session_id');
            $table->index(['company_id', 'status'], 'idx_loading_exceptions_company_status');
        });

        Schema::table('driver_assignments', function (Blueprint $table): void {
            $table->index('vehicle_assignment_id', 'idx_driver_assignments_vehicle_assignment');
            $table->index('driver_id', 'idx_driver_assignments_driver_id');
            $table->index(['company_id', 'status'], 'idx_driver_assignments_company_status');
        });

        Schema::table('loading_tasks', function (Blueprint $table): void {
            $table->index('loading_session_id', 'idx_loading_tasks_session_id');
            $table->index('vehicle_assignment_id', 'idx_loading_tasks_assignment_id');
            $table->index('product_id', 'idx_loading_tasks_product_id');
            $table->index(['vehicle_assignment_id', 'status'], 'idx_loading_tasks_assignment_status');
        });

        Schema::table('vehicle_inventory_items', function (Blueprint $table): void {
            $table->index('vehicle_assignment_id', 'idx_veh_inv_items_assignment_id');
            $table->index('vehicle_id', 'idx_veh_inv_items_vehicle_id');
            $table->index('product_id', 'idx_veh_inv_items_product_id');
        });

        Schema::table('vehicle_inventory_movements', function (Blueprint $table): void {
            $table->index('vehicle_inventory_item_id', 'idx_veh_inv_movements_inv_item_id');
            $table->index('vehicle_assignment_id', 'idx_veh_inv_movements_assignment_id');
            $table->index('recorded_at', 'idx_veh_inv_movements_recorded_at');
        });

        Schema::table('allocation_records', function (Blueprint $table): void {
            $table->index('vehicle_assignment_id', 'idx_alloc_records_assignment_id');
            $table->index('order_id', 'idx_alloc_records_order_id');
            $table->index('product_id', 'idx_alloc_records_product_id');
            $table->index(['vehicle_assignment_id', 'status'], 'idx_alloc_records_status');
        });

        Schema::table('allocation_decisions', function (Blueprint $table): void {
            $table->index('allocation_record_id', 'idx_alloc_decisions_record_id');
        });

        Schema::table('route_plans', function (Blueprint $table): void {
            $table->index('vehicle_assignment_id', 'idx_route_plans_vehicle_assignment');
            $table->index(['company_id', 'status'], 'idx_route_plans_company_status');
        });

        Schema::table('route_plan_stops', function (Blueprint $table): void {
            $table->index('route_plan_id', 'idx_route_stops_route_plan_id');
            $table->index('order_id', 'idx_route_stops_order_id');
        });

        Schema::table('shipment_groups', function (Blueprint $table): void {
            $table->index('loading_session_id', 'idx_shipment_groups_session_id');
            $table->index(['company_id', 'status'], 'idx_shipment_groups_company_status');
        });

        Schema::table('vehicle_shift_reconciliations', function (Blueprint $table): void {
            $table->index('vehicle_assignment_id', 'idx_reconciliations_assignment_id');
            $table->index(['company_id', 'status'], 'idx_reconciliations_company_status');
        });

        Schema::table('vehicle_shift_reconciliation_lines', function (Blueprint $table): void {
            $table->index('reconciliation_id', 'idx_recon_lines_reconciliation_id');
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_plans', function (Blueprint $table): void {
            $table->dropIndex('idx_vehicle_plans_company_id');
            $table->dropIndex('idx_vehicle_plans_company_status');
            $table->dropIndex('idx_vehicle_plans_company_date');
            $table->dropIndex('idx_vehicle_plans_shipping_company_id');
            $table->dropIndex('idx_vehicle_plans_zone_id');
        });

        Schema::table('vehicle_plan_slots', function (Blueprint $table): void {
            $table->dropIndex('idx_plan_slots_vehicle_plan_id');
            $table->dropIndex('idx_plan_slots_plan_status');
        });

        Schema::table('vehicle_plan_slot_orders', function (Blueprint $table): void {
            $table->dropIndex('idx_plan_slot_orders_slot_id');
            $table->dropIndex('idx_plan_slot_orders_plan_id');
            $table->dropIndex('idx_plan_slot_orders_order_id');
        });

        Schema::table('vehicle_plan_adjustment_log', function (Blueprint $table): void {
            $table->dropIndex('idx_plan_adj_log_vehicle_plan_id');
            $table->dropIndex('idx_plan_adj_log_actor_id');
        });

        Schema::table('loading_sessions', function (Blueprint $table): void {
            $table->dropIndex('idx_loading_sessions_company_id');
            $table->dropIndex('idx_loading_sessions_company_status');
            $table->dropIndex('idx_loading_sessions_company_date');
            $table->dropIndex('idx_loading_sessions_warehouse_id');
        });

        Schema::table('vehicle_assignments', function (Blueprint $table): void {
            $table->dropIndex('idx_vehicle_assignments_loading_session_id');
            $table->dropIndex('idx_vehicle_assignments_vehicle_id');
            $table->dropIndex('idx_vehicle_assignments_company_status');
        });

        Schema::table('loading_exceptions', function (Blueprint $table): void {
            $table->dropIndex('idx_loading_exceptions_session_id');
            $table->dropIndex('idx_loading_exceptions_company_status');
        });

        Schema::table('driver_assignments', function (Blueprint $table): void {
            $table->dropIndex('idx_driver_assignments_vehicle_assignment');
            $table->dropIndex('idx_driver_assignments_driver_id');
            $table->dropIndex('idx_driver_assignments_company_status');
        });

        Schema::table('loading_tasks', function (Blueprint $table): void {
            $table->dropIndex('idx_loading_tasks_session_id');
            $table->dropIndex('idx_loading_tasks_assignment_id');
            $table->dropIndex('idx_loading_tasks_product_id');
            $table->dropIndex('idx_loading_tasks_assignment_status');
        });

        Schema::table('vehicle_inventory_items', function (Blueprint $table): void {
            $table->dropIndex('idx_veh_inv_items_assignment_id');
            $table->dropIndex('idx_veh_inv_items_vehicle_id');
            $table->dropIndex('idx_veh_inv_items_product_id');
        });

        Schema::table('vehicle_inventory_movements', function (Blueprint $table): void {
            $table->dropIndex('idx_veh_inv_movements_inv_item_id');
            $table->dropIndex('idx_veh_inv_movements_assignment_id');
            $table->dropIndex('idx_veh_inv_movements_recorded_at');
        });

        Schema::table('allocation_records', function (Blueprint $table): void {
            $table->dropIndex('idx_alloc_records_assignment_id');
            $table->dropIndex('idx_alloc_records_order_id');
            $table->dropIndex('idx_alloc_records_product_id');
            $table->dropIndex('idx_alloc_records_status');
        });

        Schema::table('allocation_decisions', function (Blueprint $table): void {
            $table->dropIndex('idx_alloc_decisions_record_id');
        });

        Schema::table('route_plans', function (Blueprint $table): void {
            $table->dropIndex('idx_route_plans_vehicle_assignment');
            $table->dropIndex('idx_route_plans_company_status');
        });

        Schema::table('route_plan_stops', function (Blueprint $table): void {
            $table->dropIndex('idx_route_stops_route_plan_id');
            $table->dropIndex('idx_route_stops_order_id');
        });

        Schema::table('shipment_groups', function (Blueprint $table): void {
            $table->dropIndex('idx_shipment_groups_session_id');
            $table->dropIndex('idx_shipment_groups_company_status');
        });

        Schema::table('vehicle_shift_reconciliations', function (Blueprint $table): void {
            $table->dropIndex('idx_reconciliations_assignment_id');
            $table->dropIndex('idx_reconciliations_company_status');
        });

        Schema::table('vehicle_shift_reconciliation_lines', function (Blueprint $table): void {
            $table->dropIndex('idx_recon_lines_reconciliation_id');
        });
    }
};
