<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 4 — Capacity operations.
 *
 * ┌─ NETWORK IS STILL THE CAPACITY AUTHORITY ───────────────────────────────┐
 * │ network_capacity_slots.committed_* has exactly ONE writer, and it is     │
 * │ CapacityLedgerService. Nothing here computes, stores or adjusts a        │
 * │ capacity figure.                                                         │
 * │                                                                          │
 * │ ops_capacity_reservations is the OPERATIONAL ENVELOPE around a ledger    │
 * │ commitment: who asked, for what, on whose behalf, and what the ledger    │
 * │ answered. capacity_commitment_id is the receipt. The quantities are      │
 * │ stored as the REQUEST that was made — an immutable record of the ask,    │
 * │ not a second copy of the ledger's balance.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ops_capacity_reservations', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();

            $table->foreignId('capacity_slot_id')
                ->constrained('network_capacity_slots')->cascadeOnDelete();

            // The ledger's receipt. Null while the request is pending, and null
            // again after a failure — the absence says "the ledger holds
            // nothing for this request", which is exactly what it means.
            $table->foreignId('capacity_commitment_id')->nullable()
                ->constrained('network_capacity_commitments')->nullOnDelete();

            $table->foreignId('resource_pool_id')->nullable()
                ->constrained('ops_resource_pools')->nullOnDelete();

            // pending | held | confirmed | released | failed
            // This is the REQUEST lifecycle. The ledger commitment has its own
            // status and remains the authority on whether capacity is held.
            $table->string('status', 20)->default('pending');

            // What was asked for. Never recomputed, never reconciled downward:
            // this is the ask as it was made.
            $table->unsignedInteger('requested_orders')->default(0);
            $table->unsignedInteger('requested_stops')->default(0);
            $table->decimal('requested_weight_kg', 12, 2)->default(0);
            $table->decimal('requested_volume_m3', 12, 3)->default(0);

            // Who this capacity is for, in the requester's own vocabulary.
            $table->string('reference_type', 40)->nullable();
            $table->string('reference_id', 64)->nullable();

            $table->text('purpose')->nullable();

            $table->timestamp('requested_at');
            $table->unsignedBigInteger('requested_by')->nullable();

            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->text('release_reason')->nullable();

            // When the ledger refused, its own words. Never paraphrased.
            $table->text('failure_reason')->nullable();

            // Set when a rebalance moved this reservation off another slot.
            $table->foreignId('rebalanced_from_slot_id')->nullable()
                ->constrained('network_capacity_slots')->nullOnDelete();

            $table->timestamps();

            $table->index(['company_id', 'status'], 'ops_reservation_company_status_idx');
            $table->index(['capacity_slot_id', 'status'], 'ops_reservation_slot_status_idx');
            $table->index(['reference_type', 'reference_id'], 'ops_reservation_reference_idx');
        });

        // APPEND-ONLY. Capacity disputes are settled from this table, so a row
        // that can be edited after the fact settles nothing.
        Schema::create('ops_reservation_audit_entries', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->uuid('company_id')->nullable();
            $table->foreignId('capacity_reservation_id')
                ->constrained('ops_capacity_reservations')->cascadeOnDelete();

            // requested | held | confirmed | released | expired | failed | rebalanced
            $table->string('action', 30);

            // The ledger's answer at that moment, verbatim where it refused.
            $table->text('outcome')->nullable();
            $table->text('reason')->nullable();
            $table->json('context')->nullable();

            $table->timestamp('performed_at');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name', 150)->nullable();

            $table->timestamps();

            $table->index(['capacity_reservation_id', 'performed_at'], 'ops_reservation_audit_res_idx');
            $table->index(['company_id', 'action'], 'ops_reservation_audit_action_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ops_reservation_audit_entries');
        Schema::dropIfExists('ops_capacity_reservations');
    }
};
