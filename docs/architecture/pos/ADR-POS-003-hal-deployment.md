# ADR-POS-003 — Hardware Abstraction Layer (HAL) Deployment Model

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

The POS must communicate with physical hardware: receipt printers, barcode scanners, cash drawers, payment terminals, and customer displays. The specification describes a Hardware Abstraction Layer (HAL) but does not precisely define where the HAL runs or how browser-based UIs talk to native serial/USB devices.

## Decision

The HAL uses a **two-tier deployment model**:

**Tier 1 — In-Browser (WebHID / Web Serial):**  
Devices that support the W3C WebHID or Web Serial APIs are managed directly by the browser adapter. No local process required. Examples: USB barcode scanners (HID mode), some receipt printers.

**Tier 2 — Local Hardware Agent (WebSocket):**  
Devices requiring native OS drivers are managed by a lightweight **local agent process** (provided with the POS installation). The POS frontend connects to the agent at `ws://localhost:8765` (configurable via `POS_HAL_AGENT_URL`). The agent speaks a JSON-RPC protocol. Business logic never calls device APIs directly — it always calls the HAL abstraction layer, which routes to the appropriate tier.

The `pos.hal.agent_ws_url` and `pos.hal.agent_connect_timeout` config keys control connectivity.

## Consequences

**Positive:**
- Business logic is fully decoupled from hardware. Swapping a printer model is a driver/adapter concern.
- Tier 1 covers the "zero-install" use case for modern USB devices.
- Tier 2 covers legacy devices (serial ports, proprietary SDKs).

**Negative / Watch-outs:**
- Tier 2 requires the hardware agent to be installed and running. The frontend must handle `agent_unavailable` gracefully (show error, not crash).
- Security: the WebSocket endpoint is localhost-only and must not be exposed externally.

## Alternatives Considered

- **Native Electron app** — rejected. Adds a separate deployment target; the web SPA is the primary interface.
- **All in-browser** — rejected. Cannot reach legacy serial devices without native OS access.
