<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('warehouse_transfers')) {
            return;
        }

        Schema::create('warehouse_transfers', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->string('transfer_number')->unique();

            $table->foreignUuid('company_id')
                ->constrained('companies')
                ->restrictOnDelete();

            $table->foreignUuid('source_warehouse_id')
                ->constrained('warehouses')
                ->restrictOnDelete();

            $table->foreignUuid('destination_warehouse_id')
                ->constrained('warehouses')
                ->restrictOnDelete();

            $table->foreignUuid('product_id')
                ->constrained('products')
                ->restrictOnDelete();

            $table->decimal('quantity', 15, 4);
            $table->decimal('total_cost', 15, 4)->default(0);
            $table->decimal('weighted_unit_cost', 15, 4)->default(0);

            $table->string('status')->default('completed');

            $table->uuid('transferred_by')->nullable();
            $table->timestamp('transferred_at')->useCurrent();

            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->json('meta')->nullable();

            $table->timestamps();

            // Lookup indexes
            $table->index(['company_id', 'source_warehouse_id',      'product_id'], 'wt_src_product_idx');
            $table->index(['company_id', 'destination_warehouse_id', 'product_id'], 'wt_dest_product_idx');
            $table->index('transferred_at');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_transfers');
    }
};
