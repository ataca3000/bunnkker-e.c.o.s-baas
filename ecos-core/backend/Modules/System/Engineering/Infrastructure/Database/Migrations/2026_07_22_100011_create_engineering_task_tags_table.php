<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_task_tags', function (Blueprint $table) {
            $table->uuid('task_id');
            $table->string('tag', 100);
            $table->timestamp('created_at');

            $table->primary(['task_id', 'tag']);

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_task_tags');
    }
};
