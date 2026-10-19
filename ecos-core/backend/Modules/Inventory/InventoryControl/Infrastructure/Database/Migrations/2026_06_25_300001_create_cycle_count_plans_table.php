<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cycle_count_plans')) {
            return;
        }

        Schema::create('cycle_count_plans', function (Blueprint $table): void {
            $table->uuid('id')->primary();

            $table->uuid('product_id')->unique()->index();
            $table->enum('abc_class', ['A', 'B', 'C']);
            $table->unsignedSmallInteger('frequency_days'); // 30 / 90 / 180

            $table->date('last_counted_at')->nullable();
            $table->date('next_due_at')->nullable();
            $table->boolean('is_overdue')->default(false);

            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cycle_count_plans');
    }
};
