<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engineering_release_candidate_tasks', function (Blueprint $table) {
            $table->uuid('release_candidate_id');
            $table->uuid('task_id');
            $table->uuid('added_by_id');
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->primary(['release_candidate_id', 'task_id']);

            $table->foreign('release_candidate_id')
                ->references('id')
                ->on('engineering_release_candidates')
                ->cascadeOnDelete();

            $table->foreign('task_id')
                ->references('id')
                ->on('engineering_tasks')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_release_candidate_tasks');
    }
};
