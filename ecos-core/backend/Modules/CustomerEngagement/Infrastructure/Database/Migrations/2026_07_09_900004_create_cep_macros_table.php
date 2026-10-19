<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_macros')) {
            return;
        }

        Schema::create('cep_macros', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->foreignId('created_by')->constrained('users');

            $table->string('name');
            $table->string('shortcut')->nullable()->index();  // /welcome, /thanks
            $table->string('category');                       // MacroCategory enum
            $table->text('content');
            $table->json('variables')->nullable();            // {customer_name}, {order_id}
            $table->json('applies_to_channels')->nullable();  // null = all channels
            $table->unsignedInteger('usage_count')->default(0);
            $table->boolean('is_shared')->default(true);      // false = personal macro

            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'category'], 'cep_macro_co_cat_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_macros');
    }
};
