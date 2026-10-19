<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('engineering_task_labels')) {
            return;
        }

        Schema::create('engineering_task_labels', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('name', 100);
            $table->string('color', 7)->default('#6B7280');
            $table->string('description', 255)->nullable();
            $table->uuid('created_by_id');
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_labels');
    }
};
