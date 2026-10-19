<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('marketing_provider_events')) {
            return;
        }

        Schema::create('marketing_provider_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('event_name', 100)->index();
            $table->uuid('company_id')->index();
            $table->string('provider', 50)->index();
            $table->string('provider_type', 50);
            $table->string('current_status', 50)->nullable();
            $table->string('previous_status', 50)->nullable();
            $table->uuid('triggered_by')->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->string('environment', 50)->default('production');
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['company_id', 'provider', 'occurred_at']);
            $table->index(['event_name', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_provider_events');
    }
};
