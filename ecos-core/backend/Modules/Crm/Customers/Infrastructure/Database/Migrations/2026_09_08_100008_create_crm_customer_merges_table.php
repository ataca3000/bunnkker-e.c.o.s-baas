<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Customer Foundation — EPIC C1. Customer merge audit (append-only).
 *
 * When two records are found to be the same person, one survives and the other
 * is archived with `merged_into_id` pointing at the survivor — the row is never
 * deleted (it may be referenced by orders/finance). This table is the immutable
 * record of what was merged into what, by whom, and what moved.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_customer_merges')) {
            return;
        }

        Schema::create('crm_customer_merges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->uuid('surviving_customer_id');
            $table->uuid('merged_customer_id');
            $table->json('summary')->nullable();
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->timestamp('performed_at');
            $table->timestamps();

            $table->index('surviving_customer_id', 'crm_cmerge_surviving_idx');
            $table->index('merged_customer_id', 'crm_cmerge_merged_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_customer_merges');
    }
};
