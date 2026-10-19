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
        if (Schema::hasTable('wave_engine_configurations')) {
            return;
        }

        Schema::create('wave_engine_configurations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('warehouse_id')->index();

            // Schedule windows — stored as TIME strings, evaluated in warehouse timezone
            $table->string('collection_start_time', 8)->default('06:00:00');
            $table->string('preparation_start_time', 8)->default('09:00:00');
            $table->string('wave_end_time', 8)->default('18:00:00');

            // Automation toggles
            $table->boolean('auto_create')->default(true);
            $table->boolean('auto_assign_orders')->default(true);
            $table->boolean('auto_move_to_preparing')->default(true);

            // Configuration
            $table->json('eligible_order_statuses');
            $table->string('timezone', 60)->default('UTC');
            $table->boolean('is_active')->default(true);

            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');

            $table->unique(['company_id', 'warehouse_id'], 'uq_wave_engine_config_company_warehouse');
        });

        DB::statement('ALTER TABLE wave_engine_configurations ADD CONSTRAINT chk_wave_engine_config_times CHECK (preparation_start_time > collection_start_time AND wave_end_time > preparation_start_time)');
    }

    public function down(): void
    {
        Schema::dropIfExists('wave_engine_configurations');
    }
};
