<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('stock_ledger_entries')) {
            return;
        }

        Schema::create('stock_ledger_entries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('inventory_item_id')->constrained('inventory_items')->restrictOnDelete();
            // Denormalized for efficient reporting queries (avoids joins on hot read paths).
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('company_id')->constrained('companies')->restrictOnDelete();
            $table->string('movement_type');
            $table->decimal('quantity', 15, 4);
            $table->decimal('on_hand_before', 15, 4);
            $table->decimal('on_hand_after', 15, 4);
            $table->decimal('reserved_before', 15, 4);
            $table->decimal('reserved_after', 15, 4);
            $table->string('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->text('notes')->nullable();
            // Immutable — no updated_at column.
            $table->timestamp('created_at')->useCurrent();

            $table->index('warehouse_id');
            $table->index('product_id');
            $table->index('company_id');
            $table->index('movement_type');
            $table->index('created_at');
            $table->index(['reference_type', 'reference_id']);
            $table->index('inventory_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_ledger_entries');
    }
};
