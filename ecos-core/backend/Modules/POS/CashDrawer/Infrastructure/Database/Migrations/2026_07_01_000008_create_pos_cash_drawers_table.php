<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_cash_drawers')) {
            return;
        }

        Schema::create('pos_cash_drawers', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Cross-module UUID references (no FK constraints per ADR-POS-001)
            $table->uuid('terminal_id');
            $table->uuid('session_id');
            $table->uuid('shift_id')->unique();   // one drawer per shift
            $table->uuid('cashier_id');

            $table->string('currency', 3);
            $table->string('status', 20)->default('open');

            $table->json('opening_float');
            $table->json('movements')->nullable();
            $table->json('closing_count')->nullable();

            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_cash_drawers');
    }
};
