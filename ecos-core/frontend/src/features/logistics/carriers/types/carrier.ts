/**
 * Carrier account types — mirror CarrierController and CarrierAccountResource.
 *
 * A carrier account is an integration record: which adapter serves it, what it
 * can do, and how its statuses map onto delivery statuses. It is not a
 * settlement or a contract; those live elsewhere.
 */

export const CARRIER_MODES = ['internal', 'external'] as const;

export type CarrierMode = (typeof CARRIER_MODES)[number];

export const CARRIER_STATUSES = ['draft', 'active', 'disabled'] as const;

export type CarrierStatus = (typeof CARRIER_STATUSES)[number];

export type CarrierOption = { value: string; label?: string };

export type CarrierAdapter = {
  key?: string;
  value?: string;
  label?: string;
  name?: string;
  description?: string;
};

/**
 * `absence_meaning` explains what it means for a capability NOT to be
 * supported. It is published per capability because absence is not uniformly
 * "unavailable" — for some it means the platform handles it instead.
 */
export type CarrierCapability = {
  capability: string;
  is_supported: boolean;
  absence_meaning: string | null;
};

export type CarrierOptions = {
  adapters: CarrierAdapter[];
  capabilities: { value: string; absence_meaning: string | null }[];
  modes: { value: CarrierMode; label: string }[];
  statuses: { value: CarrierStatus; label: string }[];
};

export type CarrierAccount = {
  id: number;
  uuid: string;
  company_id: string | null;
  adapter_key: string;
  code: string;
  name: string;
  mode: CarrierMode;
  is_internal: boolean;
  status: CarrierStatus;
  is_active: boolean;
  is_default: boolean;
  priority: number;
  has_credentials: boolean;
  shipping_company_id: number | null;
  shipping_company: { id: number; name: string } | null;
  capabilities?: CarrierCapability[];
  constraints?: Record<string, unknown> | null;
  status_mapping_count?: number;
  notes: string | null;
  created_at: string | null;
};

export type CarrierAccountsQuery = {
  status?: CarrierStatus;
  mode?: CarrierMode;
  per_page?: number;
  page?: number;
};

export type CarrierAccountsResult = {
  data: CarrierAccount[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};

export type CarrierCapabilitiesResult = {
  supported: string[];
  all: CarrierCapability[];
};

export type CarrierStatusMapping = {
  id: number;
  carrier_status: string;
  delivery_status: string | null;
  failure_reason: string | null;
  is_complete: boolean;
  description: string | null;
};

/** Adapter-defined; every adapter returns at least ok and message. */
export type CarrierConnectionTest = {
  ok: boolean;
  message: string;
};

export type CreateCarrierAccountPayload = {
  adapter_key: string;
  code: string;
  name: string;
  mode?: CarrierMode;
  shipping_company_id?: number | null;
  priority?: number | null;
  notes?: string | null;
};

export type UpsertStatusMappingPayload = {
  carrier_status: string;
  delivery_status?: string | null;
  failure_reason?: string | null;
  description?: string | null;
};
