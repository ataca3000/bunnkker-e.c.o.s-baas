<?php

declare(strict_types=1);

namespace App\Contracts;

/**
 * Contract for single-purpose Action objects.
 *
 * An Action encapsulates one discrete unit of work behind a single public
 * {@see ActionInterface::execute()} method (Single Responsibility Principle).
 * Implementations live in modules and the framework provides
 * {@see \App\Core\Actions\BaseAction} as a convenient base class.
 */
interface ActionInterface
{
    /**
     * Execute the action.
     *
     * @param  mixed  ...$arguments  Arbitrary input required by the action.
     * @return mixed The result produced by the action.
     */
    public function execute(mixed ...$arguments): mixed;
}
