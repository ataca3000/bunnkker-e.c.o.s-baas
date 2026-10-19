<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_task_checklists', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('task_id');
            $table->uuid('company_id');
            $table->string('title', 500);
            $table->unsignedSmallInteger('position')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();

            $table->index(['task_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_checklists');
    }
};
