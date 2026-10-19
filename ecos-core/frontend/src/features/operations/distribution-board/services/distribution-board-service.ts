import type {
  AddCustodyPayload,
  AssignDriverPayload,
  CoverageOrder,
  CreateTripPayload,
  DeparturePayload,
  DispatchGateDashboardData,
  DispatchGateTripDetail,
  DistributionBoardData,
  DistributionTrip,
  DriverAcceptancePayload,
  ExternalCarrier,
  FleetDriver,
  FleetVehicle,
  HandoverStatus,
  LoadingDashboardData,
  LoadingManifest,
  ManifestSummary,
  PoolOrder,
  ProductBreakdownItem,
  TripAuditEntry,
  TripOrder,
  TripStatus,
  UpdateTripPayload,
  ValidationResult,
  WaveException,
} from '../types/distribution-board';

const BASE = '/api/distribution';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Board ───────────────────────────────────────────────────────────────────

export async function fetchBoard(): Promise<DistributionBoardData> {
  return request(`${BASE}/board`);
}

export async function fetchZoneOrders(zoneId: number): Promise<{ orders: PoolOrder[] }> {
  return request(`${BASE}/board/zones/${zoneId}/orders`);
}

export async function fetchTripOrders(tripId: string): Promise<{ orders: TripOrder[] }> {
  return request(`${BASE}/board/trips/${tripId}/orders`);
}

export async function validateBoard(): Promise<ValidationResult> {
  return request(`${BASE}/board/validate`, { method: 'POST' });
}

export async function finalizeBoard(): Promise<{ message: string }> {
  return request(`${BASE}/board/finalize`, { method: 'POST' });
}

// ─── Trips ───────────────────────────────────────────────────────────────────

export async function createTrip(payload: CreateTripPayload): Promise<DistributionTrip> {
  return request(`${BASE}/trips`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTrip(id: string, payload: UpdateTripPayload): Promise<DistributionTrip> {
  return request(`${BASE}/trips/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTrip(id: string): Promise<void> {
  await request(`${BASE}/trips/${id}`, { method: 'DELETE' });
}

export async function autoFillTrip(id: string): Promise<{
  trip: DistributionTrip;
  assigned_orders: TripOrder[];
  assigned_count: number;
}> {
  return request(`${BASE}/trips/${id}/auto-fill`, { method: 'POST' });
}

export async function addOrderToTrip(tripId: string, orderId: string): Promise<{ orders_count: number; collection_amount: number }> {
  return request(`${BASE}/trips/${tripId}/orders`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  });
}

export async function removeOrderFromTrip(tripId: string, orderId: string): Promise<{ orders_count: number; collection_amount: number }> {
  return request(`${BASE}/trips/${tripId}/orders/${orderId}`, { method: 'DELETE' });
}

export async function moveOrderBetweenTrips(fromTripId: string, toTripId: string, orderId: string): Promise<{ message: string }> {
  return request(`${BASE}/trips/${fromTripId}/orders/move`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, to_trip_id: toTripId }),
  });
}

export async function assignTripDriver(tripId: string, payload: AssignDriverPayload): Promise<DistributionTrip> {
  return request(`${BASE}/trips/${tripId}/driver`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function assignTripVehicle(tripId: string, vehicleId: number | null): Promise<DistributionTrip> {
  return request(`${BASE}/trips/${tripId}/vehicle`, {
    method: 'PATCH',
    body: JSON.stringify({ fleet_vehicle_id: vehicleId }),
  });
}

export async function assignTripCarrier(tripId: string, carrierId: number | null): Promise<DistributionTrip> {
  return request(`${BASE}/trips/${tripId}/carrier`, {
    method: 'PATCH',
    body: JSON.stringify({ external_carrier_id: carrierId }),
  });
}

export async function addCustodyItem(tripId: string, payload: AddCustodyPayload): Promise<{ id: number } & AddCustodyPayload> {
  return request(`${BASE}/trips/${tripId}/custody`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeCustodyItem(tripId: string, custodyId: number): Promise<void> {
  await request(`${BASE}/trips/${tripId}/custody/${custodyId}`, { method: 'DELETE' });
}

// ─── Trip approval + exceptions ───────────────────────────────────────────────

export async function approveTrip(tripId: string): Promise<{
  trip: DistributionTrip;
  manifest: ManifestSummary;
  message: string;
}> {
  return request(`${BASE}/trips/${tripId}/approve`, { method: 'POST' });
}

export async function returnOrderToWave(
  tripId: string,
  orderId: string,
  payload?: { reason?: string; notes?: string },
): Promise<{ message: string; orders_count: number }> {
  return request(`${BASE}/trips/${tripId}/orders/${orderId}/return-to-wave`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
}

export async function fetchCoverageMap(tripId: string): Promise<{ orders: CoverageOrder[] }> {
  return request(`${BASE}/trips/${tripId}/coverage`);
}

export async function fetchTripManifestSummary(tripId: string): Promise<{ manifest: ManifestSummary | null }> {
  return request(`${BASE}/trips/${tripId}/manifest`);
}

export async function fetchWaveExceptions(): Promise<{ exceptions: WaveException[]; count: number }> {
  return request(`${BASE}/board/exceptions`);
}

// ─── Loading manifests ────────────────────────────────────────────────────────

export async function fetchManifest(id: number): Promise<{ manifest: LoadingManifest }> {
  return request(`${BASE}/manifests/${id}`);
}

export async function startManifest(id: number): Promise<{ manifest: LoadingManifest }> {
  return request(`${BASE}/manifests/${id}/start`, { method: 'POST' });
}

export async function completeManifest(id: number): Promise<{ message: string; manifest: LoadingManifest }> {
  return request(`${BASE}/manifests/${id}/complete`, { method: 'POST' });
}

export async function confirmManifestItem(
  manifestId: number,
  itemId: number,
  loadedQty: number,
): Promise<{ item: LoadingManifest['items'][0]; manifest: LoadingManifest }> {
  return request(`${BASE}/manifests/${manifestId}/items/${itemId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ loaded_qty: loadedQty }),
  });
}

export async function resolveManifestShortage(
  manifestId: number,
  itemId: number,
  payload: { resolution: string; notes?: string },
): Promise<{ item: LoadingManifest['items'][0] }> {
  return request(`${BASE}/manifests/${manifestId}/items/${itemId}/resolve-shortage`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchProductBreakdown(
  manifestId: number,
  itemId: number,
): Promise<{ item: LoadingManifest['items'][0]; breakdown: ProductBreakdownItem[] }> {
  return request(`${BASE}/manifests/${manifestId}/items/${itemId}/breakdown`);
}

// ─── Loading OS Dashboard ─────────────────────────────────────────────────────

export async function fetchLoadingTrips(): Promise<LoadingDashboardData> {
  return request(`${BASE}/loading-trips`);
}

// ─── Driver Handover ──────────────────────────────────────────────────────────

export async function fetchHandoverStatus(tripId: string): Promise<HandoverStatus> {
  return request(`${BASE}/trips/${tripId}/handover-status`);
}

export async function driverConfirmProduct(
  manifestId: number,
  itemId: number,
  receivedQty: number,
): Promise<{ item: object; status: HandoverStatus }> {
  return request(`${BASE}/manifests/${manifestId}/items/${itemId}/driver-confirm`, {
    method: 'POST',
    body: JSON.stringify({ received_qty: receivedQty }),
  });
}

export async function acceptProductDiscrepancy(
  manifestId: number,
  itemId: number,
  notes?: string,
): Promise<{ item: object; status: HandoverStatus }> {
  return request(`${BASE}/manifests/${manifestId}/items/${itemId}/accept-discrepancy`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function driverConfirmCustody(
  tripId: string,
  custodyId: number,
  receivedQty: number,
): Promise<{ item: object; status: HandoverStatus }> {
  return request(`${BASE}/trips/${tripId}/custody/${custodyId}/driver-confirm`, {
    method: 'POST',
    body: JSON.stringify({ received_qty: receivedQty }),
  });
}

export async function dispatchTrip(tripId: string): Promise<{ message: string; trip: object }> {
  return request(`${BASE}/trips/${tripId}/dispatch`, { method: 'POST' });
}

// ─── Dispatch Gate (ADR-DIST-007) ────────────────────────────────────────────

export async function fetchDispatchGate(): Promise<DispatchGateDashboardData> {
  return request(`${BASE}/dispatch-gate`);
}

export async function fetchDispatchGateWorkspace(tripId: string): Promise<DispatchGateTripDetail> {
  return request(`${BASE}/dispatch-gate/${tripId}`);
}

export async function driverAcceptTrip(
  tripId: string,
  payload: DriverAcceptancePayload,
): Promise<{ message: string; trip: { id: string; status: TripStatus; driver_acceptance_at: string | null; has_discrepancy: boolean } }> {
  return request(`${BASE}/trips/${tripId}/driver-accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function dispatchVehicle(
  tripId: string,
  payload: DeparturePayload,
): Promise<{ message: string; trip: { id: string; status: TripStatus; departure_at: string | null } }> {
  return request(`${BASE}/trips/${tripId}/dispatch-vehicle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchAuditTrail(tripId: string): Promise<{ audit_trail: TripAuditEntry[] }> {
  return request(`${BASE}/trips/${tripId}/audit-trail`);
}

// ─── Fleet resources ─────────────────────────────────────────────────────────

export async function fetchFleetVehicles(): Promise<{ vehicles: FleetVehicle[] }> {
  return request(`${BASE}/fleet/vehicles`);
}

export async function fetchFleetDrivers(): Promise<{ drivers: FleetDriver[] }> {
  return request(`${BASE}/fleet/drivers`);
}

export async function fetchExternalCarriers(): Promise<{ carriers: ExternalCarrier[] }> {
  return request(`${BASE}/fleet/carriers`);
}
