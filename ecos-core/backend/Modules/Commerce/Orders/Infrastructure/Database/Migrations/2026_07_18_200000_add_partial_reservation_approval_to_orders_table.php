<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * P1-002 — Partial Reserved Approval gate.
 *
 * Adds two nullable columns to orders so the system can track whether a
 * manager has explicitly approved proceeding to preparation with a partial
 * reservation. MoveToPreparationWorkflow checks partial_reservation_approved_at
 * before allowing the transition when reservation_status = partial_reserved.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'partial_reservation_approved_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('partial_reservation_approved_at')->nullable()->after('reservation_failure_reason');
            $table->string('partial_reservation_approved_by')->nullable()->after('partial_reservation_approved_at');
            $table->text('partial_reservation_approval_notes')->nullable()->after('partial_reservation_approved_by');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'partial_reservation_approved_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn([
                'partial_reservation_approved_at',
                'partial_reservation_approved_by',
                'partial_reservation_approval_notes',
            ]);
        });
    }
};
