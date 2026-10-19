<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enterprise_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('event_id', 36)->unique();
            $table->string('event_name', 120)->index();
            $table->string('version', 20)->default('1.0.0');
            $table->timestampTz('occurred_at');
            $table->string('correlation_id', 36)->index();
            $table->string('causation_id', 36)->nullable()->index();
            $table->string('company_id', 36)->nullable()->index();
            $table->string('warehouse_id', 36)->nullable()->index();
            $table->string('module', 80)->nullable()->index();
            $table->string('aggregate_type', 80)->nullable()->index();
            $table->string('aggregate_id', 36)->nullable()->index();
            $table->jsonb('payload');
            $table->jsonb('metadata');
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->boolean('is_replay')->default(false);
            $table->string('trace_id', 36)->nullable();
            $table->string('status', 30)->default('pending')->index();
            $table->string('event_class', 255)->nullable();
            $table->timestamps();

            $table->index(['company_id', 'occurred_at']);
            $table->index(['aggregate_type', 'aggregate_id']);
            $table->index(['company_id', 'module', 'occurred_at']);
            $table->index(['event_name', 'company_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enterprise_events');
    }
};
