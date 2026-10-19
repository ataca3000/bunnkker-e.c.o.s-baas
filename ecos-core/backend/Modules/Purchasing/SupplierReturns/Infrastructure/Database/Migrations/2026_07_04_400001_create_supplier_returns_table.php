<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('supplier_returns');
        if (Schema::hasTable('supplier_returns')) {
            return;
        }

        Schema::create('supplier_returns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('return_number', 50)->unique();

            // References
            $table->foreignUuid('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $table->foreignUuid('purchase_order_id')->nullable()->constrained('purchase_orders')->nullOnDelete();
            $table->foreignUuid('goods_receipt_id')->nullable()->constrained('goods_receipts')->nullOnDelete();

            // Workflow
            $table->string('status', 30)->default('draft');
            $table->string('reason', 50)->nullable();
            $table->string('quality_condition', 30)->nullable();

            // Return details
            $table->date('return_date');
            $table->date('expected_credit_date')->nullable();
            $table->text('notes')->nullable();
            $table->text('internal_notes')->nullable();

            // Financial impact
            $table->decimal('total_return_value', 18, 4)->default(0);
            $table->string('credit_method', 30)->nullable();  // credit_note|refund|replacement
            $table->decimal('credit_amount', 18, 4)->nullable();
            $table->string('debit_note_number', 100)->nullable();
            $table->date('credit_received_date')->nullable();

            // Inventory impact
            $table->boolean('inventory_restocked')->default(false);
            $table->timestamp('inventory_restocked_at')->nullable();

            // Approval workflow (users.id is bigint — match with unsignedBigInteger)
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->foreign('submitted_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->foreign('approved_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();

            // Completion
            $table->unsignedBigInteger('completed_by')->nullable();
            $table->foreign('completed_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['supplier_id', 'status']);
            $table->index(['status', 'return_date']);
            $table->index('return_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_returns');
    }
};
