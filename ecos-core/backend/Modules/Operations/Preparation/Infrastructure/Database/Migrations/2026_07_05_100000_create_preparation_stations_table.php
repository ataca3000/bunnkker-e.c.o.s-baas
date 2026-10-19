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
        if (Schema::hasTable('preparation_stations')) {
            return;
        }

        Schema::create('preparation_stations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('warehouse_id');
            $table->string('name', 100);
            $table->string('name_ar', 100)->nullable();
            $table->string('station_type', 50);
            $table->string('zone', 100)->nullable();
            $table->integer('capacity')->nullable();
            $table->string('status', 50)->default('active');
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->uuid('created_by');
            $table->uuid('updated_by');
            $table->timestampTz('deleted_at')->nullable();
            $table->uuid('deleted_by')->nullable();

            $table->index('company_id', 'idx_stations_company_id');
            $table->index('warehouse_id', 'idx_stations_warehouse_id');
            $table->index(['company_id', 'status'], 'idx_stations_company_status');
        });

        DB::statement("ALTER TABLE preparation_stations ADD CONSTRAINT chk_stations_type CHECK (station_type IN ('picking','assembly','quality_check','packaging','storage'))");
        DB::statement("ALTER TABLE preparation_stations ADD CONSTRAINT chk_stations_status CHECK (status IN ('active','inactive','maintenance'))");
        DB::statement('ALTER TABLE preparation_stations ADD CONSTRAINT chk_stations_capacity_positive CHECK (capacity IS NULL OR capacity > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('preparation_stations');
    }
};
