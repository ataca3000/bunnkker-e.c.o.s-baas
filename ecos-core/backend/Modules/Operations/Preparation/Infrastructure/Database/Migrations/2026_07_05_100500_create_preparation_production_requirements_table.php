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
        if (Schema::hasTable('preparation_production_requirements')) {
            return;
        }

        Schema::create('preparation_production_requirements', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete();
            $table->uuid('product_id');
            $table->string('sku_snapshot', 100);
            $table->string('name_snapshot', 255);
            $table->decimal('quantity_required', 18, 4);
            $table->decimal('quantity_available', 18, 4);
            $table->decimal('quantity_to_manufacture', 18, 4)->default(0);
            $table->integer('priority')->default(5);
            $table->uuid('manufacturing_job_id')->nullable();
            $table->string('status', 50)->default('pending');
            $table->timestampTz('analyzed_at');
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(
                ['preparation_wave_id', 'product_id'],
                'uq_prep_production_req_wave_product',
            );
            $table->index('preparation_wave_id', 'idx_prep_production_req_wave_id');
            $table->index('product_id', 'idx_prep_production_req_product_id');
        });

        DB::statement("ALTER TABLE preparation_production_requirements ADD CONSTRAINT chk_prod_req_status CHECK (status IN ('pending','job_created','manufacturing','ready'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_production_requirements');
    }
};
