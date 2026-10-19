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
        if (Schema::hasTable('loading_sessions')) {
            return;
        }

        Schema::create('loading_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('warehouse_id');
            $table->string('session_number', 50);
            $table->date('operational_date');
            $table->uuid('vehicle_plan_id')->nullable();
            $table->string('status', 50);
            $table->string('session_type', 50)->default('standard');
            $table->integer('vehicles_count')->default(0);
            $table->integer('orders_count')->default(0);
            $table->integer('products_count')->default(0);
            $table->decimal('total_units_to_load', 18, 4)->default(0);
            $table->decimal('total_units_loaded', 18, 4)->default(0);
            $table->timestampTz('loading_started_at')->nullable();
            $table->uuid('loading_started_by')->nullable();
            $table->timestampTz('loading_completed_at')->nullable();
            $table->uuid('loading_completed_by')->nullable();
            $table->timestampTz('allocation_started_at')->nullable();
            $table->timestampTz('allocation_completed_at')->nullable();
            $table->timestampTz('dispatched_at')->nullable();
            $table->uuid('dispatched_by')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->uuid('config_version_id')->nullable();
            $table->uuid('supervisor_id')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['company_id', 'session_number'], 'uq_loading_sessions_company_session_number');
        });

        DB::statement("ALTER TABLE loading_sessions ADD CONSTRAINT chk_loading_sessions_status CHECK (status IN ('draft','ready','loading','loading_complete','allocating','allocated','dispatching','dispatched','reconciling','closed','cancelled'))");
        DB::statement("ALTER TABLE loading_sessions ADD CONSTRAINT chk_loading_sessions_session_type CHECK (session_type IN ('standard','rush','rerun','supplementary'))");
        DB::statement('ALTER TABLE loading_sessions ADD CONSTRAINT chk_loading_sessions_total_units_to_load CHECK (total_units_to_load >= 0)');
        DB::statement('ALTER TABLE loading_sessions ADD CONSTRAINT chk_loading_sessions_total_units_loaded CHECK (total_units_loaded >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('loading_sessions');
    }
};
