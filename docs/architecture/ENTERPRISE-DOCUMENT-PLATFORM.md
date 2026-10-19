# Enterprise Document Platform — Specification

**Document:** ENTERPRISE-DOCUMENT-PLATFORM  
**Service:** EPS-03  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-EPS-ARCH-001  
**Parent:** ENTERPRISE-PLATFORM-SERVICES.md

---

## 1. Mission

> Provide **centralized enterprise document management** for every file, image, and document across all ECOS modules.

Documents in ECOS are not owned by modules. A delivery proof photo is not "owned by Logistics OS". A supplier contract is not "owned by Procurement". A product image is not "owned by Inventory".

**Documents belong to Business Objects.**

The Enterprise Document Platform is the single, authoritative store for all files. Every module attaches documents to its business objects through this platform — never by managing files independently.

---

## 2. Core Principles

1. **One document store** — no module maintains its own file storage
2. **Attached to objects, not modules** — a document belongs to an Order, Customer, or Product; modules are just actors that upload or download
3. **Storage-agnostic** — the platform abstracts the storage provider; switching from S3 to Azure Blob requires no application code changes
4. **Versioned** — every modification creates a new version; old versions are retained
5. **Permissioned** — access control is per-document and per-role
6. **Audited** — every upload, download, view, and deletion is recorded
7. **Virus-scanned** — every upload passes through a configurable scan hook before becoming accessible

---

## 3. Supported Document Types

| Category | Types |
|---|---|
| **Images** | JPEG, PNG, WebP, GIF, TIFF, HEIC |
| **Documents** | PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx) |
| **Business Documents** | Invoice (PDF), Purchase Order (PDF), Delivery Proof (PDF/image), Packing List (PDF), Quality Report (PDF), Contract (PDF) |
| **Identification** | ID photos, company registration documents, compliance certificates |
| **Logistics** | Shipping label (PDF), Barcode image, QR Code image, Waybill |
| **Media** | Video (MP4, MOV), Audio (MP3, WAV) |
| **Data** | CSV, JSON, XML exports |
| **Signatures** | Electronic Signature files |
| **Archives** | ZIP (for bulk document packages) |
| **Future** | Any file type can be added to the registry without platform changes |

---

## 4. Document Entity

```
Document
├── id                    uuid
├── company_id            → Company     — all documents are company-scoped
│
├── original_filename     string        — the filename the user uploaded
├── display_name          string        — human-friendly name (editable)
├── mime_type             string        — detected at upload; not trusted from client
├── file_size_bytes       bigint
│
├── document_type         enum          — from the registered type registry (see Section 3)
├── category              string        — higher-level grouping (e.g. "logistics", "finance")
│
├── tags[]                string[]      — user-defined tags for search/filtering
├── description           text (nullable)
│
├── current_version       int           — currently active version number
├── versions[]            → DocumentVersion[] (see Section 5)
│
├── relationships[]       → DocumentRelationship[] (see Section 6)
│
├── scan_status           enum: pending | clean | quarantined | scan_skipped
├── scan_completed_at     timestamp (nullable)
│
├── is_archived           bool          — soft-archived; not deleted
│
├── uploaded_by           → User
├── uploaded_at           timestamp
└── last_accessed_at      timestamp (nullable)
```

---

## 5. DocumentVersion Entity

Every time a document is replaced or updated, a new version is created. Old versions are retained.

```
DocumentVersion
├── id                    uuid
├── document_id           → Document
├── version_number        int           — 1 = original; increments on each update
│
├── storage_path          string        — internal storage path (opaque to consumers)
├── storage_provider      string        — which provider holds this version (e.g. "s3", "azure")
│
├── checksum_sha256       string        — integrity verification
├── file_size_bytes       bigint
│
├── change_summary        string (nullable) — what changed in this version
│
├── created_by            → User
└── created_at            timestamp
```

**Immutability rule:** DocumentVersion records are immutable after creation. The `storage_path` of a committed version never changes.

---

## 6. DocumentRelationship Entity

Documents are linked to business objects through an explicit relationship table. This is a polymorphic association — any object type can be linked.

```
DocumentRelationship
├── id                    uuid
├── document_id           → Document
│
├── object_type           string        — the business object type (e.g. "order", "supplier")
├── object_id             uuid          — the ID of the specific business object
│
├── relationship_role     string        — why this document is attached
│                                          e.g. "delivery_proof", "supplier_invoice", "quality_certificate"
│                                              "product_image", "customer_id_photo", "contract"
│
├── is_primary            bool          — one document per object per role can be primary
│
├── attached_by           → User
└── attached_at           timestamp
```

### Supported Object Types (partial list)

`order` · `customer` · `supplier` · `product` · `raw_material` · `vehicle` · `shipment` · `manufacturing_job` · `preparation_wave` · `purchase_order` · `goods_receipt` · `invoice` · `company` · `employee`

---

## 7. Storage Provider Abstraction

The platform never exposes storage provider details to callers. All file access goes through the `StorageAdapterContract`.

```php
interface StorageAdapterContract
{
    /** Store a file and return an opaque storage path. */
    public function store(UploadedFile $file, string $path): string;

    /** Generate a temporary signed URL for accessing a stored file. */
    public function temporaryUrl(string $storagePath, int $expiresInSeconds): string;

    /** Delete a stored file permanently. */
    public function delete(string $storagePath): void;

    /** Return the name of this provider (for logging). */
    public function providerName(): string;
}
```

Active provider is configured via Configuration Platform:

```
documents.storage.provider   — e.g. "s3", "azure_blob", "local" (dev only)
documents.storage.bucket     — provider-specific target
```

Switching providers does not require any application code change — only configuration.

---

## 8. Virus Scan Hook

Every document upload passes through a virus scan hook before the document becomes accessible. The scan is asynchronous to avoid blocking the upload response.

```
Document uploaded
    ↓
scan_status = pending (document stored but not accessible yet)
    ↓
VirusScanHook.scan(document_id)   → asynchronous job
    ↓
Scan result returned:
  CLEAN        → scan_status = clean; document becomes accessible
  QUARANTINED  → scan_status = quarantined; document locked; uploader notified
```

### Scan Hook Contract

```php
interface VirusScanHookContract
{
    public function scan(string $storagePath): ScanResult;
}
```

Implementation is pluggable. The default for development is `NullVirusScanHook` (always returns clean). Production binds to a real provider (ClamAV, Cloudflare, etc.) via Configuration Platform:

```
documents.virus_scan.provider   — e.g. "clamav", "cloudflare", "null"
documents.virus_scan.enabled    — toggle
```

---

## 9. Document Access Control

```
DocumentPermission
├── document_id           → Document
├── subject_type          enum: user | role | company | public
├── subject_id            uuid (nullable — null for public/role-wide)
├── permission_level      enum: view | download | update | delete | manage
└── granted_by            → User
```

### Default Permission Rules

| Document Category | Default Access |
|---|---|
| Delivery proof | Order owner + Operations team |
| Supplier invoice | Finance + Procurement |
| Customer ID photo | CRM managers only |
| Product image | All authenticated users |
| Contracts | Legal + Finance |
| Quality reports | QA + Production + Management |

Default rules are configurable via `DocumentPolicy` (Policy Engine).

---

## 10. Document Features

### Versioning
Every document update creates a new `DocumentVersion`. The `Document.current_version` always points to the latest. Old versions are accessible via the version history endpoint.

### Tagging
Free-form tags (`string[]`) on each document. Searchable and filterable.

### Categories
Structured category hierarchy (`category` field). Defined in Configuration Platform. Used for bulk operations and retention policies.

### Preview
The platform generates previews for supported file types (PDF thumbnail, image resizing). Preview generation is asynchronous — the original file is always available immediately.

### Relationships
Polymorphic — any document can be linked to multiple business objects via `DocumentRelationship`. A single invoice can be linked to both an Order and a Purchase Order.

### Permissions
Fine-grained access control per document, role, or user. Defaults from `DocumentPolicy`. Overridable per document by authorized users.

### Retention
Retention policy is per `category`:

| Category | Default Retention |
|---|---|
| delivery_proof | 3 years |
| invoice | 7 years (legal) |
| contract | 10 years (legal) |
| quality_report | 3 years |
| product_image | Indefinite |
| id_photo | 5 years (GDPR-configurable) |
| other | 2 years |

Configurable via `documents.retention.*` settings.

### Audit
Every document action is logged in `ConfigurationChangeAudit` (via Audit Platform):

| Action | Audited |
|---|---|
| Upload | ✓ |
| Download | ✓ (if `documents.audit.log_downloads = true`) |
| View (inline) | ✓ (if `documents.audit.log_views = true`) |
| Version created | ✓ |
| Attachment added/removed | ✓ |
| Permission changed | ✓ |
| Archived | ✓ |
| Quarantined | ✓ |

### Search
Full-text search across `display_name`, `description`, and `tags`. Powered by Meilisearch. Scoped to company.

---

## 11. Configuration Platform Dependency

### Policy Consumed: `DocumentPolicy`

```php
$policy = $policyEngine->resolve(DocumentPolicy::class, 'company', $companyId);
// Determines: default permissions per category, retention rules, scan requirements
```

### Configuration Settings

| Setting Key | Description |
|---|---|
| `documents.storage.provider` | Active storage provider |
| `documents.storage.max_file_size_mb` | Maximum allowed upload size |
| `documents.virus_scan.enabled` | Enable virus scanning |
| `documents.virus_scan.provider` | Scan provider |
| `documents.audit.log_downloads` | Audit every download |
| `documents.audit.log_views` | Audit every view |
| `documents.retention.<category>_years` | Retention per document category |

### Feature Flag

```
modules.document_platform   — must be enabled for the document platform to run
```

---

## 12. DDD Module Structure

```
Modules/
└── Core/
    └── EnterpriseServices/
        └── DocumentPlatform/
            ├── Domain/
            │   ├── Models/
            │   │   ├── Document.php
            │   │   ├── DocumentVersion.php
            │   │   └── DocumentRelationship.php
            │   ├── Enums/
            │   │   ├── DocumentType.php
            │   │   └── ScanStatus.php
            │   ├── ValueObjects/
            │   │   └── ScanResult.php
            │   └── Contracts/
            │       ├── StorageAdapterContract.php
            │       └── VirusScanHookContract.php
            ├── Application/
            │   ├── Services/
            │   │   ├── UploadDocumentService.php
            │   │   ├── AttachDocumentService.php
            │   │   ├── CreateDocumentVersionService.php
            │   │   └── ScanDocumentService.php
            │   └── Queries/
            │       ├── GetDocumentsByObjectQuery.php
            │       └── SearchDocumentsQuery.php
            └── Infrastructure/
                └── Adapters/
                    ├── S3StorageAdapter.php
                    ├── LocalStorageAdapter.php
                    └── NullVirusScanHook.php
```
