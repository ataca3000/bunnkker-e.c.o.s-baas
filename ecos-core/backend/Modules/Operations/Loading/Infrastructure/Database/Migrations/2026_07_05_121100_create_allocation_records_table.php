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
        if (Schema::hasTable('allocation_records')) {
            return;
        }

        Schema::create('allocation_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_assignment_id')->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('loading_session_id');
            $table->uuid('vehicle_id');
            $table->uuid('order_id');
            $table->uuid('order_line_id');
            $table->string('order_number_snapshot', 50);
            $table->string('order_type_snapshot', 50)->nullable();
            $table->uuid('product_id');
            $table->string('sku_snapshot', 100);
            $table->foreignUuid('vehicle_inventory_item_id')->constrained('vehicle_inventory_items')->restrictOnDelete();
            $table->string('allocation_mode', 50);
            $table->integer('priority_rank')->default(99);
            $table->decimal('quantity_requested', 18, 4);
            $table->decimal('quantity_allocated', 18, 4)->default(0);
            $table->decimal('quantity_loaded', 18, 4)->default(0);
            $table->decimal('quantity_delivered', 18, 4)->default(0);
            $table->decimal('quantity_remaining', 18, 4)->default(0);
            $table->boolean('is_partial')->default(false);
            $table->text('partial_reason')->nullable();
            $table->string('status', 50)->default('allocated');
            $table->timestampTz('allocated_at');
            $table->string('allocated_by', 20)->default('system');
            $table->uuid('allocated_by_user_id')->nullable();
            $table->char('last_decision_id', 26)->nullable();
            $table->uuid('policy_evaluation_id')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['vehicle_assignment_id', 'order_line_id'], 'uq_allocation_records_assignment_order_line');
        });

        DB::statement("ALTER TABLE allocation_records ADD CONSTRAINT chk_allocation_records_status CHECK (status IN ('allocated','confirmed','in_delivery','delivered','partial_delivery','failed','cancelled'))");
        DB::statement("ALTER TABLE allocation_records ADD CONSTRAINT chk_allocation_records_allocation_mode CHECK (allocation_mode IN ('full_auto','partial_auto','manual','ai_suggested','priority','fifo','custom_policy'))");
        DB::statement("ALTER TABLE allocation_records ADD CONSTRAINT chk_allocation_records_allocated_by CHECK (allocated_by IN ('system','dispatcher','driver'))");
        DB::statement('ALTER TABLE allocation_records ADD CONSTRAINT chk_allocation_records_quantity_requested CHECK (quantity_requested > 0)');
        DB::statement('ALTER TABLE allocation_records ADD CONSTRAINT chk_allocation_records_quantity_allocated CHECK (quantity_allocated >= 0)');
        DB::statement('ALTER TABLE allocation_records ADD CONSTRAINT chk_allocation_records_quantity_delivered CHECK (quantity_delivered >= 0)');
        DB::statement('ALTER TABLE allocation_records ADD CONSTRAINT chk_allocation_records_priority_rank CHECK (priority_rank >= 1)');
    }

    public function down(): void
    {
        Schema::dropIfExists('allocation_records');
    }
};
