# Value Object Catalog

**Document:** VALUE-OBJECT-CATALOG  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DOMAIN-ARCH-001  
**Parent:** ENTERPRISE-DOMAIN-MODEL.md

---

## 1. What is a Value Object?

A **Value Object** has no identity of its own. Two value objects are equal if all their attributes are equal. Value Objects are **immutable** — they are replaced, not updated.

Value Objects are reused across domains. When an entity needs to change a value object, it replaces the entire object (not a field within it).

---

## 2. Value Object Catalog

---

### VO-01: Money

**Purpose:** Represents a monetary amount in a specific currency.  
**Immutable:** Yes  
**Equality:** currency + amount

**Fields:**
- `amount`: Decimal (BCMath precision; 4 decimal places minimum)
- `currency`: ISO 4217 code (e.g. `EGP`, `USD`)

**Business Rules:**
- Amounts must not be negative (unless representing a refund or credit, in which case use a signed Money)
- Currency conversion requires an explicit exchange rate — never implicit
- Two Money values with different currencies cannot be added without conversion

**Used by:** Order totals, Product prices, Invoice amounts, Payment amounts, Cost layers, Recipe costs

---

### VO-02: Quantity

**Purpose:** Represents a measurable quantity with a unit of measure.  
**Immutable:** Yes  
**Equality:** value + unit_id

**Fields:**
- `value`: Decimal (4 decimal places)
- `unit_id`: Reference to Unit entity

**Business Rules:**
- Value must be positive (> 0) for stock quantities
- Adding two Quantities requires matching units (or a conversion policy)
- Zero quantity is allowed for "empty" states (e.g. fully consumed)

**Used by:** OrderLine quantities, StockMovement quantities, RecipeLine quantities, WaveItem quantities

---

### VO-03: Weight

**Purpose:** Represents physical weight for logistics capacity planning.  
**Immutable:** Yes  
**Equality:** value + unit (kg/g/lb)

**Fields:**
- `value`: Decimal
- `unit`: `kg` | `g` | `lb` (canonical unit is always kg internally)

**Business Rules:**
- Stored internally as kg
- Display format respects user locale

**Used by:** Vehicle capacity, Product weight, Shipment manifest

---

### VO-04: Volume

**Purpose:** Represents physical volume for logistics capacity planning.  
**Immutable:** Yes  
**Equality:** value + unit (m³/L/cm³)

**Fields:**
- `value`: Decimal
- `unit`: `m3` | `L` | `cm3` (canonical unit is always m³ internally)

**Used by:** Vehicle capacity, Product volume, Pallet volume

---

### VO-05: Address

**Purpose:** A physical location suitable for delivery or business registration.  
**Immutable:** Yes  
**Equality:** All fields combined

**Fields:**
- `line_1`: Street address (required)
- `line_2`: Apartment / floor / landmark (optional)
- `district`: District or neighborhood (optional)
- `city`: City name (required)
- `governorate_id`: Reference to Governorate (required for Egypt)
- `postal_code`: Optional
- `country_code`: ISO 3166-1 alpha-2

**Business Rules:**
- Address is incomplete without at least line_1 + city + governorate
- Address is associated with a DeliveryZone (resolved, not stored)

**Used by:** CustomerAddress, Company registration address, Supplier address, Warehouse address

---

### VO-06: PhoneNumber

**Purpose:** A validated phone number.  
**Immutable:** Yes  
**Equality:** E.164 normalized form

**Fields:**
- `raw`: Input as entered
- `normalized`: E.164 format (e.g. `+201012345678`)
- `country_code`: Detected country code

**Business Rules:**
- Must be a valid phone number format
- Normalized form is used for deduplication and communication
- Egyptian mobile numbers are 11 digits starting with 010, 011, 012, or 015

**Used by:** CustomerContact, SupplierContact, EmployeeContact, Company contact

---

### VO-07: Email

**Purpose:** A validated email address.  
**Immutable:** Yes  
**Equality:** Normalized lowercase form

**Fields:**
- `address`: The email address (lowercased, trimmed)

**Business Rules:**
- Must pass RFC 5322 format validation
- Lowercase normalization applied on creation

**Used by:** CustomerContact, SupplierContact, UserAccount, EmployeeContact

---

### VO-08: GeoPoint

**Purpose:** A geographic coordinate (latitude + longitude).  
**Immutable:** Yes  
**Equality:** latitude + longitude (to 6 decimal places)

**Fields:**
- `latitude`: Decimal (-90 to 90)
- `longitude`: Decimal (-180 to 180)

**Business Rules:**
- Precision to 6 decimal places (~0.1 meter accuracy)
- Used for route planning and zone boundary detection

**Used by:** CustomerAddress (delivery point), Warehouse location, Route waypoints

---

### VO-09: TimeWindow

**Purpose:** A specific time range on a single day (e.g. delivery window 9 AM–1 PM).  
**Immutable:** Yes  
**Equality:** start_time + end_time + timezone

**Fields:**
- `start_time`: Time (HH:MM)
- `end_time`: Time (HH:MM)
- `timezone`: IANA timezone string

**Business Rules:**
- start_time must be before end_time
- Window duration must be positive (no zero-length windows)

**Used by:** DeliveryWindow per Order, Vehicle schedule, POSSession hours, WorkingHours in NotificationPolicy

---

### VO-10: BusinessPeriod

**Purpose:** A date range spanning multiple days (e.g. fiscal quarter, campaign period).  
**Immutable:** Yes  
**Equality:** start_date + end_date

**Fields:**
- `start_date`: Date (YYYY-MM-DD)
- `end_date`: Date (YYYY-MM-DD)

**Business Rules:**
- start_date must be <= end_date (same day is allowed for single-day periods)
- Open-ended periods may use `end_date = null` (ongoing)

**Used by:** Campaign period, PurchaseOrder validity, FulfillmentProfile active period, ConfigurationVersion effective period

---

### VO-11: Percentage

**Purpose:** A percentage value used for margins, waste, discounts, and rates.  
**Immutable:** Yes  
**Equality:** value (decimal representation)

**Fields:**
- `value`: Decimal (0.00 to 100.00 for standard percentages; can exceed 100 for markup)

**Business Rules:**
- Stored as a decimal (e.g. 28.5 for 28.5%)
- Waste percentage is clamped 0–100%
- Margin percentage can be negative (loss-making)
- Markup percentage may exceed 100%

**Used by:** RecipeLine waste_percentage, Product margin, Discount percentage, Tax rate, Commission rate

---

### VO-12: Capacity

**Purpose:** Represents a vehicle or container's maximum load capability.  
**Immutable:** Yes  
**Equality:** max_weight + max_volume + max_orders

**Fields:**
- `max_weight`: Weight value object (optional)
- `max_volume`: Volume value object (optional)
- `max_orders`: Integer (optional)
- `max_pallets`: Integer (optional)

**Business Rules:**
- At least one capacity dimension must be defined
- Partial filling is tracked by comparing loaded vs. max

**Used by:** Vehicle capacity definition, VehiclePolicy constraints

---

### VO-13: PolicyReference

**Purpose:** A traceable reference to the specific Policy and version that governed a business decision.  
**Immutable:** Yes  
**Equality:** policy_id + policy_type + config_version_id

**Fields:**
- `policy_id`: UUID
- `policy_type`: Policy type name (e.g. `FulfillmentPolicy`)
- `config_version_id`: The ConfigurationVersion at decision time

**Business Rules:**
- Stored on every business decision that was policy-governed
- Enables point-in-time replay: given this reference, the exact policy can be retrieved

**Used by:** All policy-governed decisions in aggregates (loading, allocation, approval, pricing)

---

### VO-14: AuditReference

**Purpose:** Tracks who did what and when for a specific action.  
**Immutable:** Yes  
**Equality:** actor_id + actor_type + occurred_at

**Fields:**
- `actor_id`: UUID (user, system, AI, external)
- `actor_type`: `user` | `system` | `ai` | `external` | `scheduled`
- `actor_display_name`: Human-readable name
- `occurred_at`: Timestamp with timezone

**Business Rules:**
- Present on every state-changing action within an aggregate
- Cannot be retroactively modified

**Used by:** Every aggregate state transition

---

### VO-15: Status

**Purpose:** The current lifecycle state of a business entity.  
**Immutable:** No (replaced on each transition)  
**Equality:** value + transitioned_at

**Fields:**
- `value`: Enum value (domain-specific; see LIFECYCLE-MODELS.md)
- `transitioned_at`: Timestamp
- `transitioned_by`: AuditReference

**Business Rules:**
- Transitions must follow the defined state machine (see LIFECYCLE-MODELS.md)
- Illegal transitions raise a domain exception — they are never silently ignored

**Used by:** Every aggregate with a lifecycle

---

### VO-16: Priority

**Purpose:** A business-defined importance ranking.  
**Immutable:** Yes  
**Equality:** level

**Fields:**
- `level`: `critical` | `high` | `normal` | `low`

**Used by:** Order priority, Notification priority, AIRecommendation priority, Wave priority

---

### VO-17: ConfigurationReference

**Purpose:** A snapshot reference to a specific configuration setting at a point in time.  
**Immutable:** Yes  
**Equality:** config_key + value + config_version_id

**Fields:**
- `config_key`: Dot-notation key (e.g. `fulfillment.wave.max_size`)
- `value`: The resolved value at decision time
- `config_version_id`: The ConfigurationVersion that sourced this value

**Business Rules:**
- Stored alongside any business decision that used a configuration value
- Enables audit and point-in-time reconstruction

**Used by:** Any aggregate that reads configuration settings during business logic

---

### VO-18: SKU

**Purpose:** A Stock Keeping Unit identifier for a Product.  
**Immutable:** Yes (after activation)  
**Equality:** value (normalized)

**Fields:**
- `value`: String (alphanumeric + hyphens, max 50 chars)
- `normalized`: Uppercase trimmed value for comparison

**Business Rules:**
- Unique within Company
- Immutable once a Product is activated
- Format: uppercase letters, digits, hyphens only

**Used by:** Product

---

### VO-19: Coordinates (Geo Polygon)

**Purpose:** A geographic polygon defining a delivery zone boundary.  
**Immutable:** Yes  
**Equality:** sorted list of GeoPoints

**Fields:**
- `points[]`: Ordered list of GeoPoints forming the polygon

**Business Rules:**
- Minimum 3 points to form a valid polygon
- First and last points must be identical (closed polygon)

**Used by:** DeliveryZone boundary

---

### VO-20: Color

**Purpose:** A visual color token for UI display (category color, status color, campaign color).  
**Immutable:** Yes  
**Equality:** hex_code

**Fields:**
- `hex_code`: 6-digit hex color (e.g. `#3B82F6`)
- `name`: Human-readable name (optional)

**Used by:** ProductCategory, MaterialCategory, Campaign, DeliveryZone map display
