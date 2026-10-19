<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('disassembly_transactions')) {
            return;
        }

        Schema::create('disassembly_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            /** UUID generated at execution call time. Distinct from id — allows log correlation. */
            $table->string('execution_id', 36)->unique();

            /**
             * Primary idempotency key — UUID from DisassemblyPlan.plan_id.
             * UNIQUE ensures each plan is executed exactly once.
             */
            $table->string('plan_id', 36)->unique();

            /**
             * Business idempotency anchor (e.g. return_line_id).
             * A partial unique index prevents double-disassembly for the same trigger.
             * Failed transactions (status = 'failed') are excluded — they are retryable.
             */
            $table->string('trigger_id', 36)->nullable();

            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();

            /** bills_of_materials.id — which recipe was used. */
            $table->uuid('bom_id')->nullable();

            /** Monotonically increasing recipe version (for future audit and snapshot reuse). */
            $table->unsignedInteger('bom_version_number')->nullable();

            /** SHA-256 of RecipeSnapshot.toArray() at execution time. Audit trail. */
            $table->string('recipe_snapshot_hash', 64)->nullable();

            $table->decimal('qty_disassembled', 15, 4);
            $table->string('status', 20)->default('completed');

            $table->timestamp('executed_at')->useCurrent();
            $table->unsignedInteger('duration_ms')->nullable();

            $table->json('metadata')->nullable();

            $table->timestamps();

            $table->index('product_id');
            $table->index('warehouse_id');
            $table->index('trigger_id');
            $table->index('status');
            $table->index('executed_at');
            $table->index(['bom_id', 'bom_version_number']);
        });

        // Idempotency (one non-failed disassembly per trigger_id) is enforced in DisassemblyExecutor.
    }

    public function down(): void
    {
        Schema::dropIfExists('disassembly_transactions');
    }
};
