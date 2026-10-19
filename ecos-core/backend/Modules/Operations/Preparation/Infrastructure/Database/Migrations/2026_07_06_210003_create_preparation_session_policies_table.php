<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CR-PREP-001 â€” Daily Preparation Session Policy.
 *
 * Controls when and how Preparation Sessions are auto-created per warehouse.
 * A null warehouse_id means this policy applies to ALL warehouses in the company.
 * Warehouse-specific policy takes precedence over the company-wide one.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('preparation_session_policies')) {
            return;
        }

        Schema::create('preparation_session_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('warehouse_id')->nullable()->comment('null = applies to all company warehouses');
            $table->time('auto_create_time')->default('06:00:00')->comment('Wall-clock time to create daily session');
            $table->time('auto_close_time')->nullable()->comment('Wall-clock time to auto-close session; null = manual close');
            $table->json('eligible_order_statuses')->comment('Order statuses that qualify for auto-attach');
            $table->boolean('auto_attach_orders')->default(true);
            $table->boolean('auto_recalculate_demand')->default(true);
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->unique(['company_id', 'warehouse_id'], 'uq_psp_company_warehouse');
            $table->index(['company_id', 'is_active'], 'idx_psp_company_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_session_policies');
    }
};
