<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Customer-facing Proof of Delivery, owned by Delivery OS (CTO decision 2).
 *
 * Distribution's DeliveryProof remains its own trip-operational record; this
 * one carries the validation lifecycle and the artifact policy.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_pods')) {
            return;
        }

        Schema::create('delivery_pods', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('delivery_id')->constrained('delivery_deliveries')->cascadeOnDelete();
            $table->foreignId('attempt_id')->constrained('delivery_attempts')->cascadeOnDelete();

            $table->string('status', 20)->default('pending');

            // Snapshot of what the policy demanded when this POD was raised, so
            // a later policy change cannot retroactively invalidate history.
            $table->json('required_artifacts')->nullable();

            $table->string('recipient_name', 150)->nullable();
            $table->text('notes')->nullable();

            $table->timestamp('captured_at')->nullable();
            $table->foreignId('captured_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('validated_at')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();

            $table->timestamps();

            $table->unique('attempt_id', 'delivery_pods_attempt_unique');
            $table->index(['delivery_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_pods');
    }
};
