<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_discounts')) {
            return;
        }

        Schema::create('pos_discounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            // Cross-module UUID reference (no FK constraint per ADR-POS-001)
            $table->uuid('cashier_id');

            $table->string('scope', 20);            // 'line_item' | 'cart_total'
            $table->string('discount_type', 20);    // 'percentage' | 'fixed_amount'
            $table->json('discount_value');        // full DiscountValue VO serialization

            $table->string('status', 20)->default('pending');

            $table->boolean('requires_approval')->default(false);
            $table->boolean('auto_approved')->default(false);

            // Cross-module UUID reference (no FK constraint)
            $table->uuid('supervisor_id')->nullable();

            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->string('rejection_reason', 500)->nullable();

            $table->text('notes')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_discounts');
    }
};
