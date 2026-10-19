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
        if (Schema::hasTable('vehicle_shift_reconciliations')) {
            return;
        }

        Schema::create('vehicle_shift_reconciliations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignUuid('vehicle_assignment_id')->unique()->constrained('vehicle_assignments')->restrictOnDelete();
            $table->uuid('loading_session_id');
            $table->uuid('vehicle_id');
            $table->foreignUuid('driver_assignment_id')->constrained('driver_assignments')->restrictOnDelete();
            $table->date('operational_date');
            $table->string('status', 50)->default('open');
            $table->uuid('reconciled_by')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->boolean('has_variance')->default(false);
            $table->text('variance_notes')->nullable();
            $table->decimal('total_quantity_loaded', 18, 4)->default(0);
            $table->decimal('total_quantity_delivered', 18, 4)->default(0);
            $table->decimal('total_quantity_returned', 18, 4)->default(0);
            $table->decimal('total_variance', 18, 4)->default(0);
            $table->uuid('config_version_id')->nullable();
            $table->timestampTz('opened_at')->useCurrent();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');
        });

        DB::statement("ALTER TABLE vehicle_shift_reconciliations ADD CONSTRAINT chk_vehicle_shift_reconciliations_status CHECK (status IN ('open','completed','approved','disputed'))");
        DB::statement('ALTER TABLE vehicle_shift_reconciliations ADD CONSTRAINT chk_vehicle_shift_reconciliations_quantities CHECK (total_quantity_loaded >= 0 AND total_quantity_delivered >= 0 AND total_quantity_returned >= 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_shift_reconciliations');
    }
};
