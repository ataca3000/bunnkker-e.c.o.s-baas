<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_workspace_views')) {
            return;
        }

        Schema::create('engineering_workspace_views', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('user_id');
            $table->string('name');
            $table->string('context');
            $table->json('filters')->nullable();
            $table->boolean('is_shared')->default(false);
            $table->timestamps();

            $table->index(['company_id', 'user_id']);
            $table->index(['company_id', 'context']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_workspace_views');
    }
};
