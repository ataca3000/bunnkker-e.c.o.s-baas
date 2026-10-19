<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * users.id is an auto-increment bigint (existing table).
     * roles.id is a UUID (new table).
     */
    public function up(): void
    {
        if (Schema::hasTable('user_role')) {
            return;
        }

        Schema::create('user_role', function (Blueprint $table): void {
            $table->unsignedBigInteger('user_id');
            $table->uuid('role_id');

            $table->primary(['user_id', 'role_id']);

            $table->foreign('user_id')
                ->references('id')->on('users')
                ->cascadeOnDelete();

            $table->foreign('role_id')
                ->references('id')->on('roles')
                ->cascadeOnDelete();

            $table->index('user_id');
            $table->index('role_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_role');
    }
};
