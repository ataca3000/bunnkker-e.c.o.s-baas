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
        if (Schema::hasTable('shipment_groups')) {
            return;
        }

        Schema::create('shipment_groups', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('loading_session_id')->constrained('loading_sessions')->restrictOnDelete();
            $table->uuid('geography_group_id')->nullable();
            $table->uuid('shipping_company_id');
            $table->uuid('zone_id');
            $table->uuid('governorate_id');
            $table->string('group_number', 50);
            $table->string('status', 50)->default('pending');
            $table->integer('vehicle_assignments_count')->default(0);
            $table->integer('orders_count')->default(0);
            $table->integer('fully_allocated_orders')->default(0);
            $table->integer('partially_allocated_orders')->default(0);
            $table->integer('unallocated_orders')->default(0);
            $table->decimal('allocation_coverage_pct', 5, 2)->default(0);
            $table->timestampTz('dispatched_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['loading_session_id', 'shipping_company_id', 'zone_id'], 'uq_shipment_groups_session_company_zone');
        });

        DB::statement("ALTER TABLE shipment_groups ADD CONSTRAINT chk_shipment_groups_status CHECK (status IN ('pending','loading','loaded','dispatched','completed','cancelled'))");
        DB::statement('ALTER TABLE shipment_groups ADD CONSTRAINT chk_shipment_groups_allocation_coverage_pct CHECK (allocation_coverage_pct >= 0 AND allocation_coverage_pct <= 100)');
        DB::statement('ALTER TABLE shipment_groups ADD CONSTRAINT chk_shipment_groups_orders_count CHECK (orders_count >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_groups');
    }
};
