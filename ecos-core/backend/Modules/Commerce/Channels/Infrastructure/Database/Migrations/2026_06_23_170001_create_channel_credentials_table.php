<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('channel_credentials')) {
            return;
        }

        Schema::create('channel_credentials', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('channel_id')->constrained('channels')->cascadeOnDelete();
            $table->string('consumer_key');
            $table->string('consumer_secret');
            $table->timestamps();

            $table->unique('channel_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channel_credentials');
    }
};
