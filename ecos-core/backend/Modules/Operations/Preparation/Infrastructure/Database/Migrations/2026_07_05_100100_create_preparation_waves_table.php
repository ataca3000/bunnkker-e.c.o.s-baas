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
        if (Schema::hasTable('preparation_waves')) {
            return;
        }

        Schema::create('preparation_waves', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('warehouse_id');
            $table->string('wave_number', 50);
            $table->date('planning_date');
            $table->string('status', 50)->default('draft');
            $table->integer('orders_count')->default(0);
            $table->integer('products_count')->default(0);
            $table->integer('lines_count')->default(0);
            $table->decimal('total_units_required', 18, 4)->default(0);
            $table->decimal('total_units_prepared', 18, 4)->default(0);
            $table->boolean('shortage_detected')->default(false);
            $table->timestampTz('shortage_resolved_at')->nullable();
            $table->uuid('shortage_resolved_by')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->uuid('started_by')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->uuid('completed_by')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->uuid('config_version_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['company_id', 'wave_number'], 'uq_preparation_waves_company_wave_number');
        });

        DB::statement("ALTER TABLE preparation_waves ADD CONSTRAINT chk_preparation_waves_status CHECK (status IN ('draft','planning','shortage_blocked','preparing','completed','cancelled'))");
        DB::statement('ALTER TABLE preparation_waves ADD CONSTRAINT chk_preparation_waves_units_prepared CHECK (total_units_prepared >= 0)');
        DB::statement('ALTER TABLE preparation_waves ADD CONSTRAINT chk_preparation_waves_units_required CHECK (total_units_required >= 0)');
        DB::statement('ALTER TABLE preparation_waves ADD CONSTRAINT chk_preparation_waves_orders_count CHECK (orders_count >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_waves');
    }
};
