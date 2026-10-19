<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enterprise_dead_letter_queue', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('stored_event_id')->index();
            $table->string('event_id', 36)->index();
            $table->string('event_name', 120)->index();
            $table->string('subscriber_class', 255);
            $table->text('failure_reason');
            $table->longText('stack_trace')->nullable();
            $table->jsonb('event_payload');
            $table->jsonb('event_metadata');
            $table->timestampTz('occurred_at');
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->string('dlq_status', 30)->default('pending')->index();
            $table->string('company_id', 36)->nullable()->index();
            $table->timestampTz('replayed_at')->nullable();
            $table->timestamps();

            $table->index(['dlq_status', 'created_at']);
            $table->index(['company_id', 'dlq_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enterprise_dead_letter_queue');
    }
};
