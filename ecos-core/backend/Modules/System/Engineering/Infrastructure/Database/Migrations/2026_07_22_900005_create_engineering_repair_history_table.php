<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_history')) {
            return;
        }

        Schema::create('engineering_repair_history', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('session_id');
            $table->uuid('company_id');
            $table->string('event_type');
            $table->json('event_data')->nullable();
            $table->uuid('actor_id')->nullable();
            $table->timestamp('occurred_at');

            $table->index('session_id');
            $table->index('company_id');
            $table->index('occurred_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_history');
    }
};
