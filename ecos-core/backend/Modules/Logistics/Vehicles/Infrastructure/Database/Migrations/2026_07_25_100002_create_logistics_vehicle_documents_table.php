<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_vehicle_documents')) {
            return;
        }

        Schema::create('logistics_vehicle_documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('vehicle_id')
                ->constrained('logistics_vehicles')
                ->cascadeOnDelete();

            // license | insurance | inspection | other
            $table->string('type', 30);
            $table->string('title', 150)->nullable();
            $table->string('reference_number', 100)->nullable();

            $table->string('file_path', 500);
            $table->string('file_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes')->default(0);

            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->text('notes')->nullable();
            $table->string('uploaded_by', 150)->nullable();
            $table->timestamps();

            // Drives the BR-7 dispatch gate and the expiring-documents counter.
            $table->index(['vehicle_id', 'type']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_vehicle_documents');
    }
};
