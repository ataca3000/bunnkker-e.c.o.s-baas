<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('warehouse_liabilities')) {
            return;
        }

        Schema::create('warehouse_liabilities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('warehouse_id');
            $table->uuid('product_id');

            // Source traceability
            $table->uuid('count_session_id')->nullable();
            $table->uuid('count_line_id')->nullable();
            $table->uuid('waste_investigation_id')->nullable(); // when converted from investigation

            $table->string('warehouse_manager', 255)->nullable();

            // inventory_shortage | waste_transferred
            $table->string('liability_type', 50)->default('inventory_shortage');

            $table->decimal('quantity', 15, 4);
            $table->decimal('unit_cost', 15, 4);
            $table->decimal('total_cost', 15, 2);

            // pending | approved | rejected
            $table->string('status', 30)->default('pending');

            $table->string('approved_by', 255)->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('notes')->nullable();

            // YYYY-MM for monthly liability ledger
            $table->char('month', 7)->nullable();

            $table->timestamps();

            $table->index('company_id');
            $table->index('warehouse_id');
            $table->index('status');
            $table->index('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('warehouse_liabilities');
    }
};
