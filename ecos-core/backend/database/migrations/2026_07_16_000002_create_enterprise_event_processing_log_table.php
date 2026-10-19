<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enterprise_event_processing_log', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('event_id', 36)->index();
            $table->string('subscriber_class', 255);
            // idempotency_key = event_id + ':' + subscriber_class (pre-hashed for index size)
            $table->string('idempotency_key', 64)->unique();
            $table->string('status', 30)->default('processing')->index();
            $table->unsignedSmallInteger('attempt_number')->default(1);
            $table->text('error_message')->nullable();
            $table->timestampTz('processed_at')->nullable();
            $table->timestamps();

            $table->index(['event_id', 'subscriber_class']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enterprise_event_processing_log');
    }
};
