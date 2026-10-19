<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Opportunities.
 *
 * A deal in the pipeline for a customer (C1). Its expected value and probability
 * drive the forecast. Winning it records the resulting ORDER only as an opaque
 * reference — Commerce owns the order, the CRM owns the relationship.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_opportunities')) {
            return;
        }

        Schema::create('crm_opportunities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->uuid('lead_id')->nullable();
            $table->foreignUuid('pipeline_id')->nullable()->constrained('crm_pipelines')->nullOnDelete();
            $table->foreignUuid('stage_id')->nullable()->constrained('crm_pipeline_stages')->nullOnDelete();

            $table->string('name', 200);
            $table->decimal('amount', 20, 2)->default(0);
            $table->char('currency', 3)->default('EGP');
            $table->unsignedTinyInteger('probability')->default(0);
            $table->date('expected_close_date')->nullable();
            $table->string('status', 10)->default('open');   // open | won | lost
            $table->string('source', 60)->nullable();
            $table->string('lost_reason', 200)->nullable();
            $table->timestamp('won_at')->nullable();
            $table->timestamp('lost_at')->nullable();
            $table->string('order_reference', 64)->nullable(); // opaque Commerce order id on win
            $table->json('tags')->nullable();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'crm_opp_status_idx');
            $table->index(['company_id', 'customer_id'], 'crm_opp_customer_idx');
            $table->index('stage_id', 'crm_opp_stage_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_opportunities');
    }
};
