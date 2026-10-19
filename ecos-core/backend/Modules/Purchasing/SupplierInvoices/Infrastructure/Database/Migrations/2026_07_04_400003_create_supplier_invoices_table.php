<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('supplier_invoices')) {
            return;
        }

        Schema::create('supplier_invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('invoice_number', 100)->unique();
            $table->string('supplier_invoice_ref', 100)->nullable();

            // References
            $table->foreignUuid('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();

            // Auto-generated document references (populated after posting)
            $table->foreignUuid('auto_purchase_id')->nullable()->constrained('purchase_materials')->nullOnDelete();
            $table->foreignUuid('auto_receipt_id')->nullable()->constrained('goods_receipts')->nullOnDelete();

            // Workflow
            $table->string('status', 30)->default('draft');
            // draft | validated | auto_processing | posted | failed | cancelled

            // Dates
            $table->date('invoice_date');
            $table->date('due_date')->nullable();
            $table->date('delivery_date')->nullable();

            // Financials
            $table->string('currency', 3)->default('SAR');
            $table->decimal('exchange_rate', 18, 6)->default(1);
            $table->decimal('subtotal', 18, 4)->default(0);
            $table->decimal('tax_total', 18, 4)->default(0);
            $table->decimal('freight_amount', 18, 4)->default(0);
            $table->decimal('additional_costs', 18, 4)->default(0);
            $table->decimal('discount_amount', 18, 4)->default(0);
            $table->decimal('grand_total', 18, 4)->default(0);

            // Payment
            $table->string('payment_terms', 50)->nullable();
            $table->integer('payment_terms_days')->nullable();
            $table->string('payment_method', 30)->nullable();

            // Notes
            $table->text('notes')->nullable();
            $table->text('internal_notes')->nullable();

            // Auto-posting tracking
            $table->json('posting_log')->nullable();
            $table->string('posting_error', 500)->nullable();
            $table->timestamp('processing_started_at')->nullable();

            // Posting completion
            $table->unsignedBigInteger('posted_by')->nullable();
            $table->foreign('posted_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamp('posted_at')->nullable();

            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['supplier_id', 'status']);
            $table->index(['status', 'invoice_date']);
            $table->index('invoice_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_invoices');
    }
};
