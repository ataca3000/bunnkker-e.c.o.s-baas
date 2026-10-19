<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('purchase_materials')) {
            return;
        }

        Schema::create('purchase_materials', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('request_number')->unique();

            // Scope
            $table->foreignUuid('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('channel_id')->nullable(); // soft reference to Commerce channels
            $table->foreignUuid('warehouse_id')->constrained('warehouses')->restrictOnDelete();

            // Workflow
            $table->string('status')->default('draft');
            $table->string('priority')->default('normal');

            // People
            $table->string('requested_by')->nullable();
            $table->string('assigned_buyer')->nullable();

            // Dates
            $table->date('required_date')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();

            // Financials (updated by procurement actions)
            $table->decimal('estimated_value', 15, 2)->default(0);
            $table->decimal('approved_value', 15, 2)->default(0);
            $table->decimal('purchased_value', 15, 2)->default(0);

            // Audit
            $table->string('approved_by')->nullable();
            $table->string('rejected_by')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->string('created_by')->nullable();
            $table->string('updated_by')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('priority');
            $table->index('warehouse_id');
            $table->index('company_id');
            $table->index('required_date');
            $table->index('assigned_buyer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_materials');
    }
};
