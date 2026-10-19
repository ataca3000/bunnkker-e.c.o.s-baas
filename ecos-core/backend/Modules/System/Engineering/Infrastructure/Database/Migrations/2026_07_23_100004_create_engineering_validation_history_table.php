<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_validation_history')) {
            return;
        }

        Schema::create('engineering_validation_history', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('validation_id')->nullable();
            $table->uuid('patch_id');
            $table->uuid('company_id');
            $table->string('event_type');
            $table->json('event_data')->nullable();
            $table->uuid('actor_id')->nullable();
            $table->timestamp('occurred_at');

            $table->index('patch_id');
            $table->index('validation_id');
            $table->index('occurred_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_validation_history');
    }
};
