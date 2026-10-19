<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Proof of delivery. `photos` is a JSON array of stored paths — Laravel's
 * portable json() column rather than PostgreSQL JSONB.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('distribution_delivery_proofs')) {
            return;
        }

        Schema::create('distribution_delivery_proofs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stop_id')->constrained('distribution_delivery_stops')->cascadeOnDelete();

            $table->string('signature_path', 500)->nullable();
            $table->json('photos')->nullable();
            $table->text('notes')->nullable();

            $table->timestamp('captured_at')->nullable();
            $table->foreignId('captured_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('stop_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_delivery_proofs');
    }
};
