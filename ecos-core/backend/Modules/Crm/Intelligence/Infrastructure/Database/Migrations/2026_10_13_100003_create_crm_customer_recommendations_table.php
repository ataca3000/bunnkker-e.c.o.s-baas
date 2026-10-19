<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Intelligence — EPIC C5. Rule-based recommendations.
 *
 * Next-best-action suggestions produced by DETERMINISTIC rules over the
 * intelligence profile — no generative AI. Every row records the exact rule that
 * fired (`rule_key`) and a plain-language `rationale`, so a human can see why the
 * action was suggested and reproduce it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_recommendations')) {
            return;
        }

        Schema::create('crm_customer_recommendations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();

            $table->string('type', 40);              // retention | reactivation | upsell | ...
            $table->string('rule_key', 60);          // the deterministic rule that fired
            $table->string('title', 160);
            $table->string('rationale', 400);
            $table->unsignedTinyInteger('priority')->default(50);   // 0..100
            $table->string('status', 20)->default('open');          // open | actioned | dismissed
            $table->json('context')->nullable();
            $table->timestamp('generated_at');
            $table->timestamps();

            $table->index(['company_id', 'customer_id'], 'crm_reco_customer_idx');
            $table->index(['company_id', 'status', 'priority'], 'crm_reco_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_recommendations');
    }
};
