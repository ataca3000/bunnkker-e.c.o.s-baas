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
        if (Schema::hasTable('preparation_wave_items')) {
            return;
        }

        Schema::create('preparation_wave_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('preparation_wave_id')
                ->constrained('preparation_waves')
                ->restrictOnDelete();
            $table->uuid('product_id');
            $table->string('sku_snapshot', 100);
            $table->string('name_snapshot', 255);
            $table->decimal('quantity_required', 18, 4);
            $table->decimal('quantity_prepared', 18, 4)->default(0);
            $table->decimal('quantity_short', 18, 4)->default(0);
            $table->string('status', 50)->default('pending');
            $table->timestampTz('prepared_at')->nullable();
            $table->uuid('prepared_by')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['preparation_wave_id', 'product_id'], 'uq_preparation_wave_items_wave_product');
            $table->index('preparation_wave_id', 'idx_preparation_wave_items_wave_id');
            $table->index('product_id', 'idx_preparation_wave_items_product_id');
        });

        DB::statement("ALTER TABLE preparation_wave_items ADD CONSTRAINT chk_wave_items_status CHECK (status IN ('pending','in_progress','prepared','short','blocked'))");
        DB::statement('ALTER TABLE preparation_wave_items ADD CONSTRAINT chk_wave_items_qty_required_positive CHECK (quantity_required > 0)');
        DB::statement('ALTER TABLE preparation_wave_items ADD CONSTRAINT chk_wave_items_qty_prepared_non_negative CHECK (quantity_prepared >= 0)');
        DB::statement('ALTER TABLE preparation_wave_items ADD CONSTRAINT chk_wave_items_qty_short_non_negative CHECK (quantity_short >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_wave_items');
    }
};
