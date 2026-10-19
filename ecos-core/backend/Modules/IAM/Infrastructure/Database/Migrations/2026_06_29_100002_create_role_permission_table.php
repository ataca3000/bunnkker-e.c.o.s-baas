<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('role_permission')) {
            return;
        }

        Schema::create('role_permission', function (Blueprint $table): void {
            $table->uuid('role_id');
            $table->uuid('permission_id');

            $table->primary(['role_id', 'permission_id']);

            $table->foreign('role_id')
                ->references('id')->on('roles')
                ->cascadeOnDelete();

            $table->foreign('permission_id')
                ->references('id')->on('permissions')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_permission');
    }
};
