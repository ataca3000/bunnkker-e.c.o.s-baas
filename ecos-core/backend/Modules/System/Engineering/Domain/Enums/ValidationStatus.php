<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;
enum ValidationStatus: string {
    case Pending  = 'pending';
    case Running  = 'running';
    case Passed   = 'passed';
    case Failed   = 'failed';
    case Skipped  = 'skipped';
    case Warning  = 'warning';

    public function isTerminal(): bool {
        return in_array($this, [self::Passed, self::Failed, self::Skipped]);
    }
}
