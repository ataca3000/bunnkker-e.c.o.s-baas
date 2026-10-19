<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_notes')) {
            return;
        }

        Schema::create('order_notes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->cascadeOnDelete();
            $table->string('type', 50)->default('internal'); // internal | customer | system
            $table->text('content');
            $table->uuid('user_id')->nullable();
            $table->string('user_name', 255)->nullable();
            $table->string('user_role', 100)->nullable();
            $table->boolean('is_edited')->default(false);
            $table->uuid('edited_by_id')->nullable();
            $table->string('edited_by_name', 255)->nullable();
            $table->timestamp('edited_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('order_id');
            $table->index(['order_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_notes');
    }
};
