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
        if (Schema::hasTable('preparation_inventory_reservations')) {
            return;
        }

        Schema::create('preparation_inventory_reservations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete();
            $table->string('reservable_type', 50);   // 'raw_material' | 'finished_good'
            $table->uuid('reservable_id');            // raw_material_id or product_id
            $table->string('reservable_name_snapshot', 255);
            $table->decimal('quantity_reserved', 18, 4);
            $table->string('status', 30)->default('created'); // created | updated | released | consumed
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('released_at')->nullable();
            $table->uuid('released_by')->nullable();
            $table->timestampTz('consumed_at')->nullable();
            $table->uuid('consumed_by')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->index(['company_id', 'preparation_wave_id'], 'idx_prep_reserv_company_wave');
            $table->index(['company_id', 'reservable_id', 'reservable_type'], 'idx_prep_reserv_reservable');
            $table->index('status', 'idx_prep_reserv_status');
        });

        DB::statement(
            'ALTER TABLE preparation_inventory_reservations ADD CONSTRAINT chk_prep_reserv_type '
            ."CHECK (reservable_type IN ('raw_material','finished_good'))",
        );
        DB::statement(
            'ALTER TABLE preparation_inventory_reservations ADD CONSTRAINT chk_prep_reserv_status '
            ."CHECK (status IN ('created','updated','released','consumed'))",
        );
        DB::statement(
            'ALTER TABLE preparation_inventory_reservations ADD CONSTRAINT chk_prep_reserv_qty_positive '
            .'CHECK (quantity_reserved > 0)',
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_inventory_reservations');
    }
};
