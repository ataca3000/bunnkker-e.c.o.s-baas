<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Quotes and their lines.
 *
 * A quote is a proposal on an opportunity. Its lines describe what is offered;
 * products are REFERENCED by opaque id (Inventory/Commerce own the catalog) with
 * a free-text description. Totals are computed from the lines.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('crm_quotes')) {
            Schema::create('crm_quotes', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->nullable();
                $table->foreignUuid('customer_id')->nullable()->constrained('customers')->nullOnDelete();
                $table->uuid('opportunity_id')->nullable();
                $table->string('quote_number', 40)->unique();
                $table->string('status', 12)->default('draft');
                $table->char('currency', 3)->default('EGP');
                $table->decimal('subtotal', 20, 2)->default(0);
                $table->decimal('discount', 20, 2)->default(0);
                $table->decimal('tax', 20, 2)->default(0);
                $table->decimal('total', 20, 2)->default(0);
                $table->date('valid_until')->nullable();
                $table->text('notes')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('accepted_at')->nullable();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'status'], 'crm_quote_status_idx');
            });
        }

        if (! Schema::hasTable('crm_quote_lines')) {
            Schema::create('crm_quote_lines', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->foreignUuid('quote_id')->constrained('crm_quotes')->cascadeOnDelete();
                $table->string('description', 300);
                $table->string('product_reference', 64)->nullable(); // opaque product id
                $table->decimal('quantity', 20, 4)->default(1);
                $table->decimal('unit_price', 20, 2)->default(0);
                $table->decimal('discount', 20, 2)->default(0);
                $table->decimal('line_total', 20, 2)->default(0);
                $table->timestamps();

                $table->index('quote_id', 'crm_qline_quote_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_quote_lines');
        Schema::dropIfExists('crm_quotes');
    }
};
