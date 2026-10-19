<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM Sales & Loyalty — EPIC C4. Reward catalogue and redemptions.
 *
 * A reward costs points; redeeming it spends points (an append-only ledger
 * movement) and records a redemption. The fulfilment (a voucher, a discount
 * applied to an order) is executed and referenced elsewhere — the CRM owns the
 * redemption, not the order or the payment.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('crm_loyalty_rewards')) {
            Schema::create('crm_loyalty_rewards', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->nullable();
                $table->foreignUuid('program_id')->constrained('crm_loyalty_programs')->cascadeOnDelete();
                $table->string('name', 150);
                $table->string('description', 500)->nullable();
                $table->unsignedInteger('points_cost');
                $table->string('reward_type', 20)->default('voucher'); // discount | product | voucher | cash
                $table->decimal('value', 20, 2)->nullable();
                $table->integer('stock')->nullable();  // null = unlimited
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->index(['company_id', 'program_id', 'is_active'], 'crm_lreward_lookup_idx');
            });
        }

        if (! Schema::hasTable('crm_reward_redemptions')) {
            Schema::create('crm_reward_redemptions', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('company_id')->nullable();
                $table->foreignUuid('account_id')->constrained('crm_loyalty_accounts')->cascadeOnDelete();
                $table->foreignUuid('reward_id')->constrained('crm_loyalty_rewards')->cascadeOnDelete();
                $table->unsignedInteger('points_spent');
                $table->string('status', 12)->default('pending'); // pending | fulfilled | cancelled
                $table->string('voucher_code', 40)->nullable();
                $table->timestamp('redeemed_at');
                $table->timestamp('fulfilled_at')->nullable();
                $table->unsignedBigInteger('actor_id')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'account_id', 'status'], 'crm_lredemption_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('crm_reward_redemptions');
        Schema::dropIfExists('crm_loyalty_rewards');
    }
};
