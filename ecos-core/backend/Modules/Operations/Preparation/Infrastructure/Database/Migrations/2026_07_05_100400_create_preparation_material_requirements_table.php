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
        if (Schema::hasTable('preparation_material_requirements')) {
            return;
        }

        Schema::create('preparation_material_requirements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete();
            $table->uuid('raw_material_id');
            $table->string('material_name_snapshot', 255);
            $table->string('unit_snapshot', 50);
            $table->decimal('quantity_required', 18, 4);
            $table->decimal('quantity_available', 18, 4);
            $table->decimal('quantity_to_purchase', 18, 4)->default(0);
            $table->boolean('shortage')->default(false);
            $table->decimal('shortage_amount', 18, 4)->default(0);
            $table->timestampTz('analyzed_at');
            $table->uuid('analyzed_by')->default('00000000-0000-0000-0000-000000000001');
            $table->uuid('purchase_request_id')->nullable();
            $table->boolean('resolved')->default(false);
            $table->timestampTz('resolved_at')->nullable();
            $table->uuid('resolved_by')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(
                ['preparation_wave_id', 'raw_material_id'],
                'uq_prep_material_req_wave_material',
            );
            $table->index('preparation_wave_id', 'idx_prep_material_req_wave_id');
            $table->index('raw_material_id', 'idx_prep_material_req_material_id');
        });

        DB::statement('ALTER TABLE preparation_material_requirements ADD CONSTRAINT chk_material_req_qty_required_positive CHECK (quantity_required > 0)');
        DB::statement('ALTER TABLE preparation_material_requirements ADD CONSTRAINT chk_material_req_qty_available_non_neg CHECK (quantity_available >= 0)');
        DB::statement('ALTER TABLE preparation_material_requirements ADD CONSTRAINT chk_material_req_shortage_amount_non_neg CHECK (shortage_amount >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_material_requirements');
    }
};
