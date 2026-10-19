<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('logistics_driver_documents')) {
            return;
        }

        Schema::create('logistics_driver_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')
                ->constrained('logistics_drivers')
                ->cascadeOnDelete();

            // license | national_id | employment_contract | medical_certificate | other
            $table->string('type', 40);
            $table->string('title', 150)->nullable();

            $table->string('file_path', 500);
            $table->string('file_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes')->default(0);

            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->text('notes')->nullable();
            $table->string('uploaded_by', 150)->nullable();
            $table->timestamps();

            $table->index(['driver_id', 'type']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logistics_driver_documents');
    }
};
