<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('waste_investigations')) {
            return;
        }

        Schema::create('waste_investigations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('warehouse_id');
            $table->uuid('count_session_id');
            $table->uuid('count_line_id');
            $table->uuid('product_id');

            $table->decimal('quantity', 15, 4);
            $table->decimal('unit_cost', 15, 4)->nullable();
            $table->decimal('total_cost', 15, 2)->nullable();

            $table->string('damage_reason', 100)->nullable();

            // pending_investigation â†’ resolved
            $table->string('status', 30)->default('pending_investigation');

            // operational_waste | warehouse_responsibility | supplier_responsibility | preparation_responsibility
            $table->string('outcome', 60)->nullable();

            $table->text('investigator_notes')->nullable();
            $table->string('resolved_by', 255)->nullable();
            $table->timestamp('resolved_at')->nullable();

            // YYYY-MM for monthly reporting
            $table->char('month', 7)->nullable();

            $table->timestamps();

            $table->index('company_id');
            $table->index('warehouse_id');
            $table->index('status');
            $table->index('product_id');
            $table->index('count_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_investigations');
    }
};
