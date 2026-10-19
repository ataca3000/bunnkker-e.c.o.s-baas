<?php

declare(strict_types=1);

namespace Modules\POS\Terminal\Domain\Models;

use DateTimeImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Terminal\Domain\Enums\TerminalStatus;
use Modules\POS\Terminal\Domain\Exceptions\InvalidTerminalStatusTransitionException;
use Modules\POS\Terminal\Domain\ValueObjects\HardwareConfig;

/**
 * Terminal aggregate root.
 *
 * Represents a physical or virtual POS device registered to a branch and
 * warehouse. All status transitions enforce invariants and throw domain
 * exceptions on invalid state changes.
 *
 * Persistence: EloquentTerminalRepository.save() persists the in-memory state.
 * Domain events: collected in the application service after each command.
 *
 * @property string $id
 * @property string $terminal_code
 * @property string $name
 * @property string $branch_id
 * @property string $warehouse_id
 * @property TerminalStatus $status
 * @property array $hardware_config
 * @property string|null $last_seen_at
 * @property string|null $last_seen_ip
 * @property array|null $metadata
 */
final class Terminal extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'pos_terminals';

    /** @var list<string> */
    protected $fillable = [
        'terminal_code',
        'name',
        'branch_id',
        'warehouse_id',
        'status',
        'hardware_config',
        'last_seen_at',
        'last_seen_ip',
        'metadata',
    ];

    /** @return array<string, string|class-string> */
    protected function casts(): array
    {
        return [
            'status' => TerminalStatus::class,
            'hardware_config' => 'array',
            'metadata' => 'array',
            'last_seen_at' => 'datetime',
        ];
    }

    // -------------------------------------------------------------------------
    // Factory method
    // -------------------------------------------------------------------------

    /**
     * Create a new terminal in memory (Inactive by default).
     * The caller must persist via TerminalRepositoryInterface::save().
     */
    public static function register(
        string $terminalCode,
        string $name,
        string $branchId,
        string $warehouseId,
        HardwareConfig $hardwareConfig,
    ): self {
        if (trim($terminalCode) === '') {
            throw new InvalidArgumentException('Terminal code cannot be empty.');
        }
        if (trim($name) === '') {
            throw new InvalidArgumentException('Terminal name cannot be empty.');
        }

        $terminal = new self;
        $terminal->terminal_code = strtoupper(trim($terminalCode));
        $terminal->name = trim($name);
        $terminal->branch_id = $branchId;
        $terminal->warehouse_id = $warehouseId;
        $terminal->status = TerminalStatus::Inactive;
        $terminal->hardware_config = $hardwareConfig->toArray();

        return $terminal;
    }

    // -------------------------------------------------------------------------
    // State transitions
    // -------------------------------------------------------------------------

    /**
     * Transition to Active.
     * Valid from: Inactive, Maintenance.
     */
    public function activate(): void
    {
        if ($this->status === TerminalStatus::Active) {
            throw InvalidTerminalStatusTransitionException::alreadyInState(
                (string) $this->id,
                TerminalStatus::Active,
            );
        }

        $this->status = TerminalStatus::Active;
    }

    /**
     * Transition to Inactive.
     * Valid from: Active, Maintenance.
     */
    public function deactivate(): void
    {
        if ($this->status === TerminalStatus::Inactive) {
            throw InvalidTerminalStatusTransitionException::alreadyInState(
                (string) $this->id,
                TerminalStatus::Inactive,
            );
        }

        $this->status = TerminalStatus::Inactive;
    }

    /**
     * Transition to Maintenance.
     * Valid from: Active only — a terminal must be in service before it can be serviced.
     */
    public function putInMaintenance(): void
    {
        if ($this->status !== TerminalStatus::Active) {
            throw InvalidTerminalStatusTransitionException::cannotTransition(
                (string) $this->id,
                $this->status,
                TerminalStatus::Maintenance,
            );
        }

        $this->status = TerminalStatus::Maintenance;
    }

    // -------------------------------------------------------------------------
    // Behaviour
    // -------------------------------------------------------------------------

    public function updateHardwareConfig(HardwareConfig $config): void
    {
        $this->hardware_config = $config->toArray();
    }

    /**
     * Record a heartbeat from the terminal device.
     * Caller provides timestamp so the domain remains framework-independent.
     */
    public function recordHeartbeat(DateTimeImmutable $at, string $ipAddress): void
    {
        $this->last_seen_at = $at->format('Y-m-d H:i:s');
        $this->last_seen_ip = $ipAddress;
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    public function getHardwareConfig(): HardwareConfig
    {
        return HardwareConfig::fromArray($this->hardware_config ?? []);
    }

    public function isActive(): bool
    {
        return $this->status === TerminalStatus::Active;
    }

    public function isInMaintenance(): bool
    {
        return $this->status === TerminalStatus::Maintenance;
    }

    public function isInactive(): bool
    {
        return $this->status === TerminalStatus::Inactive;
    }
}
