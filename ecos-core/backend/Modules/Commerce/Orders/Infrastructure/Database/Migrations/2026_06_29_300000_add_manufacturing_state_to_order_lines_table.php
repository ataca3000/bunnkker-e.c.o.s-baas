<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * PKG-07: Adds per-order-line manufacturing state tracking.
 *
 * manufacturing_state  — current position in the manufacturing state machine
 *                        (null = not yet evaluated; see OrderLineManufacturingState enum)
 * manufacturing_result — full coordinator result serialised as JSON for audit
 * manufacturing_started_at   — when PrepareOrderManufacturingAction began processing this line
 * manufacturing_completed_at — when the coordinator returned a final result for this line
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_lines', 'manufacturing_state')) {
            return;
        }

        Schema::table('order_lines', function (Blueprint $table): void {
            $table->string('manufacturing_state', 30)->nullable()->after('line_total');
            $table->json('manufacturing_result')->nullable()->after('manufacturing_state');
            $table->timestamp('manufacturing_started_at')->nullable()->after('manufacturing_result');
            $table->timestamp('manufacturing_completed_at')->nullable()->after('manufacturing_started_at');

            $table->index('manufacturing_state');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_lines', 'manufacturing_state')) {
            return;
        }

        Schema::table('order_lines', function (Blueprint $table): void {
            $table->dropIndex(['manufacturing_state']);
            $table->dropColumn([
                'manufacturing_state',
                'manufacturing_result',
                'manufacturing_started_at',
                'manufacturing_completed_at',
            ]);
        });
    }
};
