<?php

declare(strict_types=1);

namespace Modules\POS\Session\Domain\Models;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Session\Domain\Enums\DeviceType;
use Modules\POS\Session\Domain\Events\SessionClosed;
use Modules\POS\Session\Domain\Events\SessionOpened;
use Modules\POS\Session\Domain\Events\SessionResumed;
use Modules\POS\Session\Domain\Events\SessionSuspended;
use Modules\POS\Session\Domain\Exceptions\InvalidSessionTransitionException;
use Modules\POS\Session\Domain\ValueObjects\DeviceFingerprint;
use Modules\POS\Shared\Domain\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Enums\SessionStatus;

final class Session extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'pos_sessions';

    private array $domainEvents = [];

    protected $fillable = [
        'terminal_id',
        'cashier_id',
        'company_id',
        'channel_id',
        'warehouse_id',
        'status',
        'device_fingerprint',
        'device_type',
        'ip_address',
        'opened_at',
        'suspended_at',
        'closed_at',
        'metadata',
        'terminal_open_lock',
    ];

    protected function casts(): array
    {
        return [
            'status' => SessionStatus::class,
            'device_type' => DeviceType::class,
            'metadata' => 'array',
            'opened_at' => 'datetime',
            'suspended_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    // ── Domain event collection ────────────────────────────────────────────────

    public function addEvent(DomainEvent $event): void
    {
        $this->domainEvents[] = $event;
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }

    private static function generateUuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    /**
     * Opens a new cashier session.
     *
     * terminal_id is set to cashier_id so all downstream tables (shifts, carts,
     * receipts) continue to receive a non-null UUID without schema changes.
     * The terminal_open_lock unique column enforces "one open session per cashier."
     *
     * The caller is responsible for first checking hasOpenSessionForCashier()
     * to ensure no conflicting Open session exists for the cashier.
     * The returned session is NOT persisted — call $repository->save() after.
     */
    public static function open(
        string $cashierId,
        string $companyId,
        ?string $channelId,
        string $warehouseId,
        DeviceFingerprint $fingerprint,
        string $ipAddress,
        DeviceType $deviceType = DeviceType::Browser,
    ): self {
        if (trim($cashierId) === '') {
            throw new InvalidArgumentException('Cashier ID cannot be empty.');
        }
        if (trim($companyId) === '') {
            throw new InvalidArgumentException('Company ID cannot be empty.');
        }
        if (trim($warehouseId) === '') {
            throw new InvalidArgumentException('Warehouse ID cannot be empty.');
        }

        $session = new self;
        $session->id = self::generateUuid();
        $session->terminal_id = $cashierId; // cashier_id doubles as terminal for downstream tables
        $session->cashier_id = $cashierId;
        $session->company_id = $companyId;
        $session->channel_id = $channelId;
        $session->warehouse_id = $warehouseId;
        $session->status = SessionStatus::Open;
        $session->terminal_open_lock = $cashierId; // unique per-cashier lock
        $session->device_fingerprint = $fingerprint->value;
        $session->device_type = $deviceType;
        $session->ip_address = $ipAddress;
        $session->opened_at = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

        $session->addEvent(SessionOpened::now(
            sessionId: $session->id,
            terminalId: $cashierId,
            cashierId: $cashierId,
            deviceFingerprint: $fingerprint->value,
            deviceType: $deviceType->value,
            ipAddress: $ipAddress,
        ));

        return $session;
    }

    /** Suspends an Open session (e.g. terminal lock, cashier walk-away). */
    public function suspend(): void
    {
        if ($this->status !== SessionStatus::Open) {
            throw InvalidSessionTransitionException::cannotTransition(
                (string) $this->id,
                $this->status,
                SessionStatus::Suspended,
            );
        }

        $this->status = SessionStatus::Suspended;
        $this->terminal_open_lock = null;
        $this->suspended_at = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

        $this->addEvent(SessionSuspended::now(
            sessionId: (string) $this->id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
        ));
    }

    /**
     * Moves a Suspended session to RecoveryPending when a different device
     * attempts to resume it. The session waits for supervisor approval. (ADR-POS-008)
     */
    public function requestRecovery(): void
    {
        if ($this->status !== SessionStatus::Suspended) {
            throw InvalidSessionTransitionException::cannotTransition(
                (string) $this->id,
                $this->status,
                SessionStatus::RecoveryPending,
            );
        }

        $this->status = SessionStatus::RecoveryPending;
    }

    /**
     * Resumes a Suspended or RecoveryPending session back to Open.
     * For RecoveryPending, the caller must obtain supervisor approval before calling this.
     */
    public function resume(bool $sameDevice = true): void
    {
        if (! in_array($this->status, [SessionStatus::Suspended, SessionStatus::RecoveryPending], true)) {
            throw InvalidSessionTransitionException::cannotTransition(
                (string) $this->id,
                $this->status,
                SessionStatus::Open,
            );
        }

        $this->status = SessionStatus::Open;
        $this->terminal_open_lock = (string) $this->terminal_id;
        $this->suspended_at = null;

        $this->addEvent(SessionResumed::now(
            sessionId: (string) $this->id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            sameDevice: $sameDevice,
        ));
    }

    /** Closes the session from any non-terminal state. */
    public function close(): void
    {
        if ($this->status === SessionStatus::Closed) {
            throw InvalidSessionTransitionException::alreadyInState(
                (string) $this->id,
                SessionStatus::Closed,
            );
        }

        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $openedAt = $this->opened_at instanceof DateTimeInterface
            ? DateTimeImmutable::createFromInterface($this->opened_at)
            : new DateTimeImmutable((string) $this->opened_at, new DateTimeZone('UTC'));
        $durationMinutes = (int) max(0, (int) ceil(($now->getTimestamp() - $openedAt->getTimestamp()) / 60));

        $this->status = SessionStatus::Closed;
        $this->terminal_open_lock = null;
        $this->closed_at = $now->format('Y-m-d H:i:s');

        $this->addEvent(SessionClosed::now(
            sessionId: (string) $this->id,
            terminalId: (string) $this->terminal_id,
            cashierId: (string) $this->cashier_id,
            durationMinutes: $durationMinutes,
        ));
    }

    public function getDeviceFingerprint(): DeviceFingerprint
    {
        return DeviceFingerprint::of($this->device_fingerprint);
    }

    public function getDeviceType(): DeviceType
    {
        return $this->device_type;
    }

    /** Returns true when the given fingerprint matches this session's originating device. */
    public function isSameDevice(DeviceFingerprint $fingerprint): bool
    {
        return $this->getDeviceFingerprint()->equals($fingerprint);
    }

    public function isOpen(): bool
    {
        return $this->status === SessionStatus::Open;
    }

    public function isClosed(): bool
    {
        return $this->status === SessionStatus::Closed;
    }

    /** True when the cashier can process transactions (Open state only). */
    public function canTransact(): bool
    {
        return $this->status->canTransact();
    }

    /** True for Open, Suspended, and RecoveryPending states. */
    public function isActive(): bool
    {
        return $this->status->isActive();
    }
}
