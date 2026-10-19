<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ServiceArea — a COMMERCIAL service region.
 *
 * ┌─ DIRECTIVE 4/8 — NO DUPLICATE GEOGRAPHY ────────────────────────────────┐
 * │ A service area stores no place. It is a COMPOSITION of rows that already │
 * │ exist — distribution_zones (LOG-004B), logistics_cities and              │
 * │ logistics_governorates (Geography) — joined through                      │
 * │ network_service_area_members. Only commercial attributes live here.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * A dispatch region groups service areas for planning; it is the level Dispatch
 * opens boards against, and it too holds no geography of its own.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('network_dispatch_regions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            // The dispatch origin. Warehouses and branches are V1 master data;
            // referenced, never copied.
            $table->uuid('warehouse_id')->nullable();
            $table->uuid('branch_id')->nullable();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'network_region_company_code_unique');
            $table->index(['company_id', 'is_active'], 'network_region_active_idx');
        });

        Schema::create('network_service_areas', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();

            $table->foreignId('dispatch_region_id')->nullable()
                ->constrained('network_dispatch_regions')->nullOnDelete();

            $table->string('code', 40);
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->string('status', 20)->default('draft');
            $table->text('status_reason')->nullable();

            // Commercial attributes — the only thing this table owns.
            $table->unsignedSmallInteger('default_lead_time_hours')->default(24);
            $table->unsignedSmallInteger('priority')->default(0);
            $table->string('color', 20)->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'code'], 'network_area_company_code_unique');
            $table->index(['company_id', 'status'], 'network_area_company_status_idx');
            $table->index(['dispatch_region_id', 'status'], 'network_area_region_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('network_service_areas');
        Schema::dropIfExists('network_dispatch_regions');
    }
};
