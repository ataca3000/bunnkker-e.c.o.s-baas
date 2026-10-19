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
        if (! Schema::hasTable('vehicle_shift_reconciliation_lines')) {
            Schema::create('vehicle_shift_reconciliation_lines', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('company_id');
                $table->foreignUuid('reconciliation_id')->constrained('vehicle_shift_reconciliations')->restrictOnDelete();
                $table->uuid('vehicle_inventory_item_id');
                $table->foreign('vehicle_inventory_item_id', 'fk_vsrl_vehicle_inv_item')->references('id')->on('vehicle_inventory_items')->restrictOnDelete();
                $table->uuid('product_id');
                $table->string('sku_snapshot', 100);
                $table->decimal('quantity_loaded', 18, 4);
                $table->decimal('quantity_delivered', 18, 4);
                $table->decimal('quantity_returned_expected', 18, 4);
                $table->decimal('quantity_returned_actual', 18, 4)->default(0);
                $table->decimal('variance', 18, 4)->default(0);
                $table->string('variance_resolution', 50)->nullable();
                $table->text('resolution_notes')->nullable();
                $table->uuid('resolved_by')->nullable();
                $table->timestampTz('resolved_at')->nullable();
                $table->timestampsTz();
                $table->uuid('created_by');
                $table->uuid('updated_by');

                $table->unique(['reconciliation_id', 'product_id'], 'uq_vehicle_shift_recon_lines_recon_product');
            });
        } else {
            // Table was partially created in a prior failed run — add missing FK if not already present
            try {
                Schema::table('vehicle_shift_reconciliation_lines', function (Blueprint $table): void {
                    $table->foreign('vehicle_inventory_item_id', 'fk_vsrl_vehicle_inv_item')
                        ->references('id')->on('vehicle_inventory_items')->restrictOnDelete();
                });
            } catch (Exception) {
                // FK already exists — nothing to do
            }
        }

        try {
            DB::statement("ALTER TABLE vehicle_shift_reconciliation_lines ADD CONSTRAINT chk_vehicle_shift_recon_lines_variance_resolution CHECK (variance_resolution IS NULL OR variance_resolution IN ('balanced','late_confirmed','written_off','under_investigation'))");
        } catch (Exception) {
            // Constraint already exists
        }

        try {
            DB::statement('ALTER TABLE vehicle_shift_reconciliation_lines ADD CONSTRAINT chk_vehicle_shift_recon_lines_quantities CHECK (quantity_loaded >= 0 AND quantity_delivered >= 0 AND quantity_returned_expected >= 0 AND quantity_returned_actual >= 0)');
        } catch (Exception) {
            // Constraint already exists
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_shift_reconciliation_lines');
    }
};
