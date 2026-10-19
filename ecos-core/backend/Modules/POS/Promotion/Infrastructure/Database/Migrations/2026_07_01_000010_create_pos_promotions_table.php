<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_promotions')) {
            return;
        }

        Schema::create('pos_promotions', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->string('name', 200);
            $table->text('description')->nullable();

            $table->string('status', 20)->default('draft');

            $table->json('conditions');   // PromotionCondition[] serialization
            $table->json('reward');       // PromotionReward serialization

            $table->timestamp('valid_from');
            $table->timestamp('valid_until')->nullable();

            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('use_count')->default(0);
            $table->integer('priority')->default(0);

            $table->timestamp('activated_at')->nullable();
            $table->timestamp('paused_at')->nullable();
            $table->timestamp('expired_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_reason', 500)->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index(['status', 'valid_from', 'valid_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_promotions');
    }
};
