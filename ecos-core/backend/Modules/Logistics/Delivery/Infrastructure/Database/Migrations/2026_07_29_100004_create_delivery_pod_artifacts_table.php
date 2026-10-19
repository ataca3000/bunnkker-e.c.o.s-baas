<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Signature / photo / ID scan / OTP evidence. Append-only. */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('delivery_pod_artifacts')) {
            return;
        }

        Schema::create('delivery_pod_artifacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pod_id')->constrained('delivery_pods')->cascadeOnDelete();

            $table->string('kind', 30); // signature | photo | id_scan | otp
            $table->string('file_path', 500)->nullable();
            $table->string('file_name', 255)->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->string('reference', 255)->nullable(); // OTP confirmation ref
            $table->text('notes')->nullable();

            $table->timestamp('captured_at')->nullable();
            $table->foreignId('captured_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['pod_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_pod_artifacts');
    }
};
