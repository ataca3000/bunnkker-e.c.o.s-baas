<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Loyalty accounts (the wallet).
 *
 * ┌─ NO MUTABLE BALANCE · DERIVED FROM THE LEDGER ──────────────────────────┐
 * │ An account enrols a customer in a program. It stores NO points balance —   │
 * │ the balance is the SUM of its append-only transactions. The current tier   │
 * │ is recomputed from that balance. This is the wallet, always reconcilable.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_loyalty_accounts')) {
            return;
        }

        Schema::create('crm_loyalty_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('program_id')->constrained('crm_loyalty_programs')->cascadeOnDelete();
            $table->foreignUuid('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->uuid('tier_id')->nullable();
            $table->string('status', 12)->default('active'); // active | suspended
            $table->timestamp('enrolled_at');
            $table->timestamps();

            $table->unique(['program_id', 'customer_id'], 'crm_laccount_unique');
            $table->index(['company_id', 'customer_id'], 'crm_laccount_customer_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_loyalty_accounts');
    }
};
