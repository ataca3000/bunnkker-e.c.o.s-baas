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
        if (Schema::hasTable('preparation_sessions')) {
            return;
        }

        Schema::create('preparation_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('warehouse_id');
            $table->string('session_number', 50)->notNull();
            $table->date('planning_date');
            $table->string('status', 50)->default('draft');
            $table->uuid('operator_id');
            $table->uuid('supervisor_id')->nullable();
            $table->integer('waves_count')->default(0);
            $table->integer('products_count')->default(0);
            $table->decimal('total_units_required', 18, 4)->default(0);
            $table->decimal('total_units_prepared', 18, 4)->default(0);
            $table->timestampTz('started_at')->nullable();
            $table->uuid('started_by')->nullable();
            $table->timestampTz('paused_at')->nullable();
            $table->uuid('paused_by')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->uuid('completed_by')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->uuid('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['company_id', 'session_number'], 'uq_preparation_sessions_company_number');
            $table->index('company_id', 'idx_preparation_sessions_company_id');
            $table->index(['company_id', 'planning_date'], 'idx_preparation_sessions_company_date');
            $table->index(['company_id', 'status'], 'idx_preparation_sessions_company_status');
        });

        DB::statement("ALTER TABLE preparation_sessions ADD CONSTRAINT chk_preparation_sessions_status CHECK (status IN ('draft','in_progress','paused','completed','cancelled'))");
        DB::statement('ALTER TABLE preparation_sessions ADD CONSTRAINT chk_preparation_sessions_units_required CHECK (total_units_required >= 0)');
        DB::statement('ALTER TABLE preparation_sessions ADD CONSTRAINT chk_preparation_sessions_units_prepared CHECK (total_units_prepared >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_sessions');
    }
};
