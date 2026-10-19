<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum WorkerStatus: string
{
    case Starting   = 'starting';
    case Idle       = 'idle';
    case Waiting    = 'waiting';
    case Reserved   = 'reserved';
    case Preparing  = 'preparing';
    case Running    = 'running';
    case Paused     = 'paused';
    case Completed  = 'completed';
    case Failed     = 'failed';
    case Recovering = 'recovering';
    case Updating   = 'updating';
    case Stopping   = 'stopping';
    case Offline    = 'offline';
    case Destroyed  = 'destroyed';

    public function label(): string
    {
        return match($this) {
            self::Starting   => 'Starting',
            self::Idle       => 'Idle',
            self::Waiting    => 'Waiting',
            self::Reserved   => 'Reserved',
            self::Preparing  => 'Preparing',
            self::Running    => 'Running',
            self::Paused     => 'Paused',
            self::Completed  => 'Completed',
            self::Failed     => 'Failed',
            self::Recovering => 'Recovering',
            self::Updating   => 'Updating',
            self::Stopping   => 'Stopping',
            self::Offline    => 'Offline',
            self::Destroyed  => 'Destroyed',
        };
    }

    public function isActive(): bool
    {
        return in_array($this, [
            self::Idle, self::Waiting, self::Reserved,
            self::Preparing, self::Running, self::Paused, self::Recovering,
        ]);
    }

    public function isAvailable(): bool
    {
        return in_array($this, [self::Idle, self::Waiting]);
    }

    public function canTransitionTo(self $next): bool
    {
        $allowed = match($this) {
            self::Starting   => [self::Idle, self::Offline, self::Failed],
            self::Idle       => [self::Waiting, self::Reserved, self::Preparing, self::Stopping, self::Updating, self::Offline],
            self::Waiting    => [self::Idle, self::Reserved, self::Preparing, self::Stopping],
            self::Reserved   => [self::Preparing, self::Idle, self::Stopping],
            self::Preparing  => [self::Running, self::Failed, self::Stopping],
            self::Running    => [self::Paused, self::Completed, self::Failed, self::Stopping],
            self::Paused     => [self::Running, self::Failed, self::Stopping],
            self::Completed  => [self::Idle, self::Stopping],
            self::Failed     => [self::Recovering, self::Idle, self::Stopping],
            self::Recovering => [self::Idle, self::Stopping, self::Failed],
            self::Updating   => [self::Idle, self::Offline],
            self::Stopping   => [self::Offline],
            self::Offline    => [self::Starting, self::Destroyed],
            self::Destroyed  => [],
        };

        return in_array($next, $allowed);
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
