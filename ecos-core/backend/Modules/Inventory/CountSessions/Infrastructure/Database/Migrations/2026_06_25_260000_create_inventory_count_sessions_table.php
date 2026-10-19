<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inventory_count_sessions')) {
            return;
        }

        Schema::create('inventory_count_sessions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('company_id')->index();
            $table->uuid('warehouse_id')->index();

            $table->string('count_number')->unique();
            $table->string('status')->default('draft');

            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->text('notes')->nullable();

            // Audit who initiated / approved
            $table->uuid('created_by')->nullable();
            $table->uuid('approved_by')->nullable();

            $table->timestamps();

            // FKs
            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('warehouse_id')->references('id')->on('warehouses')->cascadeOnDelete();

            $table->index(['status', 'warehouse_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_count_sessions');
    }
};
