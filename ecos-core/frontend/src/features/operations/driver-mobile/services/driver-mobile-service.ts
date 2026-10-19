import axios from 'axios';
import type {
  CustodyReturn,
  DeliveryException,
  DeliveryReturn,
  DeliveryStop,
  DeliveryStopDetail,
  DriverTrip,
  TripSettlement,
  TripTimeline,
} from '../types/driver-mobile';

const api = axios.create({ baseURL: '/api' });

// ── Active trips ────────────────────────────────────────────────────────────

export async function fetchActiveTrips(): Promise<DriverTrip[]> {
  const { data } = await api.get<DriverTrip[]>('/driver/trips');
  return data;
}

export async function fetchTripDashboard(tripId: string): Promise<DriverTrip> {
  const { data } = await api.get<DriverTrip>(`/driver/trips/${tripId}`);
  return data;
}

// ── Trip lifecycle ───────────────────────────────────────────────────────────

export async function startTrip(
  tripId: string,
  lat: number,
  lng: number,
  odoStart?: number,
): Promise<DriverTrip> {
  const { data } = await api.post(`/driver/trips/${tripId}/start`, { lat, lng, odo_start: odoStart });
  return data.trip as DriverTrip;
}

export async function finishTrip(
  tripId: string,
  lat: number,
  lng: number,
  odoEnd?: number,
): Promise<DriverTrip> {
  const { data } = await api.post(`/driver/trips/${tripId}/finish`, { lat, lng, odo_end: odoEnd });
  return data.trip as DriverTrip;
}

export async function recordGps(
  tripId: string,
  lat: number,
  lng: number,
  speed?: number,
  accuracy?: number,
): Promise<void> {
  await api.post(`/driver/trips/${tripId}/gps`, { lat, lng, speed, accuracy });
}

// ── Stops ────────────────────────────────────────────────────────────────────

export async function fetchStopList(tripId: string): Promise<DeliveryStop[]> {
  const { data } = await api.get<DeliveryStop[]>(`/driver/trips/${tripId}/stops`);
  return data;
}

export async function fetchStopDetail(tripId: string, stopId: string): Promise<DeliveryStopDetail> {
  const { data } = await api.get<DeliveryStopDetail>(`/driver/trips/${tripId}/stops/${stopId}`);
  return data;
}

// ── Delivery actions ─────────────────────────────────────────────────────────

export interface DeliveryActionPayload {
  action_type: string;
  reason?: string;
  notes?: string;
  new_delivery_date?: string;
  corrected_lat?: number;
  corrected_lng?: number;
  payment_type?: string;
  payment_amount?: number;
  reference_number?: string;
  image_path?: string;
  payment_notes?: string;
}

export async function submitDeliveryAction(
  stopId: string,
  payload: DeliveryActionPayload,
): Promise<DeliveryStop> {
  const { data } = await api.post(`/driver/stops/${stopId}/action`, payload);
  return data.stop as DeliveryStop;
}

export async function submitProofOfDelivery(
  stopId: string,
  payload: { signature_path?: string; photos?: string[]; notes?: string },
): Promise<void> {
  await api.post(`/driver/stops/${stopId}/proof`, payload);
}

export async function createException(
  stopId: string,
  payload: { exception_type: string; description: string; photos?: string[] },
): Promise<DeliveryException> {
  const { data } = await api.post(`/driver/stops/${stopId}/exception`, payload);
  return data.exception as DeliveryException;
}

// ── Payments ─────────────────────────────────────────────────────────────────

export interface CollectPaymentPayload {
  payment_type: string;
  amount: number;
  reference_number?: string;
  image_path?: string;
  notes?: string;
}

export async function collectPayment(
  stopId: string,
  payload: CollectPaymentPayload,
): Promise<void> {
  await api.post(`/driver/stops/${stopId}/payment`, payload);
}

export async function fetchTripCollections(tripId: string): Promise<unknown[]> {
  const { data } = await api.get<unknown[]>(`/driver/trips/${tripId}/collections`);
  return data;
}

// ── Exceptions ───────────────────────────────────────────────────────────────

export async function fetchTripExceptions(tripId: string): Promise<DeliveryException[]> {
  const { data } = await api.get<DeliveryException[]>(`/driver/trips/${tripId}/exceptions`);
  return data;
}

// ── Returns ──────────────────────────────────────────────────────────────────

export async function fetchTripReturns(tripId: string): Promise<DeliveryReturn[]> {
  const { data } = await api.get<DeliveryReturn[]>(`/driver/trips/${tripId}/returns`);
  return data;
}

export interface AddReturnPayload {
  order_id: number;
  product_id: number;
  product_name: string;
  return_type: string;
  qty: number;
  reason?: string;
  photos?: string[];
}

export async function addReturn(
  tripId: string,
  payload: AddReturnPayload,
): Promise<DeliveryReturn> {
  const { data } = await api.post(`/driver/trips/${tripId}/returns`, payload);
  return data.return as DeliveryReturn;
}

export async function confirmReturn(returnId: number, confirmedQty: number): Promise<DeliveryReturn> {
  const { data } = await api.post(`/driver/returns/${returnId}/confirm`, { confirmed_qty: confirmedQty });
  return data.return as DeliveryReturn;
}

// ── Settlement ───────────────────────────────────────────────────────────────

export async function fetchSettlement(tripId: string): Promise<TripSettlement> {
  const { data } = await api.get<TripSettlement>(`/driver/trips/${tripId}/settlement`);
  return data;
}

export async function submitSettlement(
  tripId: string,
  cashSubmitted: number,
  notes?: string,
): Promise<TripSettlement> {
  const { data } = await api.post(`/driver/trips/${tripId}/settlement/submit`, {
    cash_submitted: cashSubmitted,
    notes,
  });
  return data.settlement as TripSettlement;
}

// ── Custody returns ───────────────────────────────────────────────────────────

export async function fetchCustodyReturns(tripId: string): Promise<CustodyReturn[]> {
  const { data } = await api.get<CustodyReturn[]>(`/driver/trips/${tripId}/custody-returns`);
  return data;
}

export interface RecordCustodyReturnPayload {
  custody_type: string;
  dispatched_qty: number;
  returned_qty: number;
  notes?: string;
}

export async function recordCustodyReturn(
  tripId: string,
  payload: RecordCustodyReturnPayload,
): Promise<CustodyReturn> {
  const { data } = await api.post(`/driver/trips/${tripId}/custody-returns`, payload);
  return data.custody_return as CustodyReturn;
}

// ── Close trip ────────────────────────────────────────────────────────────────

export async function closeTrip(tripId: string): Promise<void> {
  await api.post(`/driver/trips/${tripId}/close`);
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export async function fetchTimeline(tripId: string): Promise<TripTimeline> {
  const { data } = await api.get<TripTimeline>(`/driver/trips/${tripId}/timeline`);
  return data;
}
