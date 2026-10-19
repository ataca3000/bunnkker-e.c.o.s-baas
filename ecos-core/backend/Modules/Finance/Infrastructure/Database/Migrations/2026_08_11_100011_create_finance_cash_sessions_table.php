<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Finance OS — EPIC F2. Cash sessions.
 *
 * An open/close cycle for a cash account (a shift on a till). Transactions
 * during the session belong to it; closing records the counted amount so an
 * over/short can be surfaced against the expected GL movement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_cash_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id');
            $table->foreignId('cash_account_id')->constrained('finance_cash_accounts')->cascadeOnDelete();

            // open | closed
            $table->string('status', 20)->default('open');
            $table->decimal('opening_float', 20, 4)->default(0);
            $table->timestamp('opened_at');
            $table->unsignedBigInteger('opened_by')->nullable();

            $table->decimal('counted_amount', 20, 4)->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();

            $table->timestamps();

            $table->index(['company_id', 'cash_account_id', 'status'], 'finance_cs_account_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_cash_sessions');
    }
};
