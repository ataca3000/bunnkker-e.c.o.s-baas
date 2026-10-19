<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Loyalty points ledger (append-only).
 *
 * One immutable row per movement. Points are SIGNED (earn +, redeem/expire −);
 * the account balance is their SUM. Earning from an order or a promotion records
 * the source only as an opaque reference — Commerce owns the order, Marketing the
 * promotion.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('crm_loyalty_transactions')) {
            return;
        }

        Schema::create('crm_loyalty_transactions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->nullable();
            $table->foreignUuid('account_id')->constrained('crm_loyalty_accounts')->cascadeOnDelete();
            $table->string('type', 12);          // earn | redeem | reward | expire | adjust
            $table->integer('points');           // signed
            $table->string('source_type', 40)->nullable();  // order | promotion | manual | reward
            $table->string('source_reference', 64)->nullable(); // opaque
            $table->uuid('reward_id')->nullable();
            $table->string('description', 300)->nullable();
            $table->timestamp('occurred_at');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->timestamps();

            $table->index(['account_id', 'occurred_at'], 'crm_ltxn_account_idx');
            $table->index(['company_id', 'type'], 'crm_ltxn_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_loyalty_transactions');
    }
};
