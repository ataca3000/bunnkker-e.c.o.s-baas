<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Modules\IAM\Domain\Models\Role;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // updateOrCreate: always restores the canonical dev password so credentials
        // cannot drift between seeder runs, factory calls, or manual DB changes.
        $admin = User::updateOrCreate(
            ['email' => 'admin@ecos.local'],
            [
                'name' => 'Administrator',
                'password' => 'Admin@123456',
            ],
        );

        // Ensure the super-admin role is always assigned.
        // syncWithoutDetaching is idempotent: re-running the seeder never removes
        // other roles that were assigned manually after the first seed.
        $superAdmin = Role::where('slug', 'super-admin')->first();
        if ($superAdmin !== null) {
            $admin->roles()->syncWithoutDetaching([$superAdmin->id]);
        }
    }
}
