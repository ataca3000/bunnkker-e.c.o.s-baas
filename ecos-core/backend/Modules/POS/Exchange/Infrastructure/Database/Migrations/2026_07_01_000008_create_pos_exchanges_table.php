<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_exchanges')) {
            return;
        }

        Schema::create('pos_exchanges', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Cross-module UUID references — no FK constraints (ADR-POS-001)
            $table->string('exchange_number', 100)->nullable(false)->unique();
            $table->uuid('original_sale_id')->nullable(false)->index();
            $table->string('original_sale_number', 100)->nullable(false);

            $table->uuid('terminal_id')->nullable(false)->index();
            $table->uuid('session_id')->nullable()->index();
            $table->uuid('shift_id')->nullable()->index();
            $table->uuid('cashier_id')->nullable(false)->index();
            $table->uuid('customer_id')->nullable()->index();

            $table->string('status', 50)->nullable(false)->default('draft')->index();
            $table->string('reason', 50)->nullable(false);
            $table->char('currency', 3)->nullable(false);

            // Snapshot of returned and replacement lines (JSONB)
            $table->json('returned_lines')->nullable(false);
            $table->json('replacement_lines')->nullable(false);

            // Pre-computed totals for reporting (JSONB Money objects)
            $table->json('returned_total')->nullable(false);
            $table->json('replacement_total')->nullable(false);

            $table->text('notes')->nullable();

            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_reason', 500)->nullable();

            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_exchanges');
    }
};
