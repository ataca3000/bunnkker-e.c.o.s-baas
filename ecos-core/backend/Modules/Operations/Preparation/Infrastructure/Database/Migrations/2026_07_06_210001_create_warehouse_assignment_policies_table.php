<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * CR-PREP-001 â€” Warehouse Assignment Engine.
 *
 * Defines how an incoming order is mapped to a specific warehouse.
 * Rules are evaluated in priority order (lower number = higher priority).
 * The first matching rule wins.
 *
 * Matching criteria (most specific wins):
 *   channel_id  + governorate  (most specific)
 *   channel_id  + null         (channel-level default)
 *   null        + governorate  (company-wide per-governorate)
 *   null        + null         (company-wide fallback)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('warehouse_assignment_policies')) {
            return;
        }

        Schema::create('warehouse_assignment_policies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->uuid('channel_id')->nullable();
            $table->string('governorate', 100)->nullable();
            $table->string('zone', 100)->nullable();
            $table->uuid('warehouse_id');
            $table->smallInteger('priority')->default(100)->comment('Lower = higher priority. Evaluated ascending.');
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestampsTz();

            $table->index(['company_id', 'is_active', 'priority'], 'idx_wap_company_active_priority');
            $table->index(['company_id', 'channel_id', 'governorate'], 'idx_wap_lookup');
            $table->index('warehouse_id', 'idx_wap_warehouse_id');
        });

        DB::statement('ALTER TABLE warehouse_assignment_policies ADD CONSTRAINT chk_wap_priority CHECK (priority >= 1 AND priority <= 9999)');
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_assignment_policies');
    }
};
