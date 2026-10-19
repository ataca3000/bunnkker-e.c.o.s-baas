<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_analytics_events')) {
            return;
        }

        Schema::create('pos_analytics_events', function (Blueprint $table): void {
            // event_id is the primary key — equals eventId() for sale-level events,
            // or a generated UUID for per-product / cashier sub-events.
            $table->uuid('event_id')->primary();

            // Event classification
            $table->string('event_type', 50);        // sale_completed | product_sold | cashier_sale

            // Context — all nullable; POS domain never creates FK constraints
            $table->string('sale_id', 36);
            $table->string('company_id', 36)->nullable();
            $table->string('warehouse_id', 36)->nullable();
            $table->string('channel_id', 36)->nullable();
            $table->string('cashier_id', 36)->nullable();
            $table->string('customer_id', 36)->nullable();

            // Full structured payload stored as JSONB for flexible querying
            $table->json('payload');

            // Business timestamp (when the sale occurred, not when the row was inserted)
            $table->timestampTz('occurred_at');
            $table->timestampTz('created_at');

            // Analytics query indexes
            $table->index(['event_type', 'occurred_at']);
            $table->index(['sale_id', 'event_type']);
            $table->index(['company_id', 'occurred_at']);
            $table->index(['warehouse_id', 'occurred_at']);
            $table->index(['cashier_id', 'occurred_at']);
            $table->index(['customer_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_analytics_events');
    }
};
