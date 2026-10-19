<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

/**
 * Development-only utility: resets the admin@ecos.local password to the
 * standard development credential.
 *
 * Refuses to execute in production so the credential can never be accidentally
 * reverted on a live environment.
 */
final class ResetDevAdminCommand extends Command
{
    protected $signature = 'ecos:reset-dev-admin';

    protected $description = 'Reset the development administrator password (local/staging only)';

    private const EMAIL = 'admin@ecos.local';

    private const PASSWORD = 'Admin@123456';

    public function handle(): int
    {
        if (app()->isProduction()) {
            $this->error('This command is not available in production.');

            return self::FAILURE;
        }

        $user = User::where('email', self::EMAIL)->first();

        if ($user === null) {
            $this->error('User not found: '.self::EMAIL);

            return self::FAILURE;
        }

        $user->password = Hash::make(self::PASSWORD);
        $user->save();

        $this->info('Development administrator password has been reset successfully.');
        $this->newLine();
        $this->line('Email:    '.self::EMAIL);
        $this->line('Password: '.self::PASSWORD);

        return self::SUCCESS;
    }
}
