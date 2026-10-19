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
        if (Schema::hasTable('loading_tasks')) {
            return;
        }

        Schema::create('loading_tasks', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('loading_session_id')->constrained('loading_sessions')->restrictOnDelete();
            $table->foreignUuid('vehicle_assignment_id')->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('pool_entry_id');
            $table->uuid('product_id');
            $table->string('sku_snapshot', 100);
            $table->string('name_snapshot', 255);
            $table->uuid('preparation_wave_id');
            $table->decimal('quantity_planned', 18, 4);
            $table->decimal('quantity_loaded', 18, 4)->default(0);
            $table->decimal('quantity_short', 18, 4)->default(0);
            $table->string('status', 50)->default('pending');
            $table->boolean('requires_refrigeration')->default(false);
            $table->uuid('loaded_by')->nullable();
            $table->timestampTz('loaded_at')->nullable();
            $table->uuid('confirmed_by')->nullable();
            $table->timestampTz('confirmed_at')->nullable();
            $table->text('short_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['vehicle_assignment_id', 'product_id'], 'uq_loading_tasks_assignment_product');
        });

        DB::statement("ALTER TABLE loading_tasks ADD CONSTRAINT chk_loading_tasks_status CHECK (status IN ('pending','in_progress','loaded','short_loaded','blocked','skipped'))");
        DB::statement('ALTER TABLE loading_tasks ADD CONSTRAINT chk_loading_tasks_quantity_planned CHECK (quantity_planned > 0)');
        DB::statement('ALTER TABLE loading_tasks ADD CONSTRAINT chk_loading_tasks_quantity_loaded CHECK (quantity_loaded >= 0)');
        DB::statement('ALTER TABLE loading_tasks ADD CONSTRAINT chk_loading_tasks_quantity_short CHECK (quantity_short >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('loading_tasks');
    }
};
