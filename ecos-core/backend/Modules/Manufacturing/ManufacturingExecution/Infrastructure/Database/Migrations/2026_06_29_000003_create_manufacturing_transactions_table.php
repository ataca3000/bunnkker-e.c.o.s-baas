<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('manufacturing_transactions')) {
            return;
        }

        Schema::create('manufacturing_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            /**
             * UUID generated at execution call time.
             * Distinct from id — allows correlation across logs even before commit.
             */
            $table->string('execution_id', 36)->unique();

            /**
             * Idempotency key — UUID from ManufacturingPlan.plan_id.
             * UNIQUE ensures each approved plan is executed exactly once.
             */
            $table->string('plan_id', 36)->unique();

            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();

            /** recipe_id from ManufacturingPlan (bills_of_materials.id). */
            $table->uuid('bom_id')->nullable();

            /** RC-10: monotonically increasing version. */
            $table->unsignedInteger('bom_version_number')->nullable();

            /** SHA-256 of RecipeSnapshot.toArray() at planning time. Audit trail. */
            $table->string('recipe_snapshot_hash', 64)->nullable();

            $table->decimal('qty_produced', 15, 4);
            $table->string('status', 20)->default('completed');

            $table->timestamp('executed_at')->useCurrent();
            $table->unsignedInteger('duration_ms')->nullable();

            /**
             * RC-10 future anchor: UNIQUE(order_line_id, bom_id, bom_version_number)
             * WHERE status != 'failed' will be enforced once Order integration is added.
             */
            $table->string('order_line_id', 100)->nullable();

            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->index('product_id');
            $table->index('warehouse_id');
            $table->index('bom_id');
            $table->index('status');
            $table->index('executed_at');
            $table->index(['bom_id', 'bom_version_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manufacturing_transactions');
    }
};
