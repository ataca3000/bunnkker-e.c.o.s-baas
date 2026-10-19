<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Persists the confirmation call result on the orders row so every view
 * (grid, drawer, detail page) can display the actual state without reading
 * the event log. TASK-ORDER-CONFIRMATION-WORKFLOW-HOTFIX-001.
 *
 * Values: confirmed | not_answered | rejected | postponed | null
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (! Schema::hasColumn('orders', 'confirmation_result')) {
                $table->string('confirmation_result', 20)
                    ->nullable()
                    ->after('customer_confirmed_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            if (Schema::hasColumn('orders', 'confirmation_result')) {
                $table->dropColumn('confirmation_result');
            }
        });
    }
};
