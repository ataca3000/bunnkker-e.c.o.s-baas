<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Contracts;

/**
 * Abstraction for pushing live pipeline state to connected clients.
 *
 * Current implementation: polling (client calls /active every 3 seconds).
 * Prepared implementations: SSE, WebSocket.
 *
 * @see \Modules\System\Engineering\Infrastructure\Transports\PollingTransport
 */
interface PipelineUpdateTransportInterface
{
    public function driver(): string;

    /** Broadcast a pipeline state change to all subscribed clients. */
    public function broadcast(string $pipelineId, string $event, array $payload): void;

    /** Subscribe a client to updates for a given pipeline. */
    public function subscribe(string $pipelineId, string $clientId): void;

    /** Unsubscribe a client from pipeline updates. */
    public function unsubscribe(string $pipelineId, string $clientId): void;
}
