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
        if (Schema::hasTable('prepared_pool_movements')) {
            return;
        }

        Schema::create('prepared_pool_movements', function (Blueprint $table): void {
            $table->char('id', 26)->primary();
            $table->uuid('company_id');
            $table->foreignUuid('pool_entry_id')
                ->constrained('prepared_products_pool')
                ->restrictOnDelete();
            $table->string('movement_type', 50);
            $table->decimal('quantity_moved', 18, 4);
            $table->uuid('from_wave_id')->nullable();
            $table->uuid('to_wave_id')->nullable();
            $table->uuid('vehicle_id')->nullable();
            $table->uuid('actor_id');
            $table->string('actor_type', 20)->default('user');
            $table->text('notes')->nullable();
            $table->timestampTz('recorded_at')->useCurrent();

            $table->index('pool_entry_id', 'idx_pool_movements_pool_entry_id');
            $table->index('recorded_at', 'idx_pool_movements_recorded_at');
            $table->index(['company_id', 'recorded_at'], 'idx_pool_movements_company_recorded_at');
        });

        DB::statement("ALTER TABLE prepared_pool_movements ADD CONSTRAINT chk_pool_movements_type CHECK (movement_type IN ('created','reserved','reservation_released','loaded','quality_failed','reallocated'))");
        DB::statement('ALTER TABLE prepared_pool_movements ADD CONSTRAINT chk_pool_movements_qty_positive CHECK (quantity_moved > 0)');
        DB::statement("ALTER TABLE prepared_pool_movements ADD CONSTRAINT chk_pool_movements_actor_type CHECK (actor_type IN ('user','system','ai'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('prepared_pool_movements');
    }
};
