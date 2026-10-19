<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_shifts')) {
            return;
        }

        Schema::create('pos_shifts', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedInteger('shift_number');
            $table->uuid('session_id');
            $table->uuid('terminal_id');
            $table->uuid('cashier_id');
            $table->string('status', 50)->default('open');

            // Cash amounts stored as JSONB {amount, currency} — currency is consistent
            // across all amounts within a single shift (enforced by the domain aggregate).
            $table->json('opening_cash');
            $table->json('closing_count')->nullable();
            $table->json('expected_closing')->nullable();
            $table->json('variance')->nullable();

            $table->string('rejection_reason', 500)->nullable();
            $table->timestamp('opened_at');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Each shift number is unique within a terminal, enforcing sequential identity.
            $table->unique(['terminal_id', 'shift_number'], 'pos_shifts_terminal_shift_number_unique');

            $table->index('session_id');
            $table->index('terminal_id');
            $table->index('cashier_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_shifts');
    }
};
