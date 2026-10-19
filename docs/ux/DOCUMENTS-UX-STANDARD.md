# Documents UX — Standard

**Document:** DOCUMENTS-UX-STANDARD  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-UX-ARCH-001  
**Parent:** ENTERPRISE-UX-ARCHITECTURE.md  
**Backend:** ENTERPRISE-DOCUMENT-PLATFORM.md (EPS-03)

---

## 1. Mission

> Every business object can have documents. The document experience is identical everywhere — upload, preview, organize, version, and audit files in one consistent interface.

Documents belong to Business Objects, not to modules. The Documents tab in a Supplier drawer and the Documents tab in an Order drawer look and behave identically.

---

## 2. Where Documents Appear

Documents is a standard tab in every Detail Drawer.

**Also appears as:**
- **Standalone document panel** in workspaces that are document-heavy (e.g. Supplier Workspace's Documents section, Receiving Center for delivery docs)
- **Inline attachment** in Timeline entries (document attached = timeline event + preview link)
- **Quick attachments** in forms (e.g. attach a file directly while filling a PO form)

---

## 3. Documents Tab Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  DOCUMENTS  [Category ▼] [Search...]            [+ Upload Document] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CONTRACTS (2)                                                       │
│  ─────────────────────────────────────────────────                  │
│  │ 📄 Supply Agreement 2026.pdf   [Preview] [Download] [More ▼]    │
│  │    Ahmed Trading · v2 · 2.4 MB · Uploaded 12 Jan 2026           │
│  │    ● Clean  (virus scan)                                         │
│  │                                                                  │
│  │ 📄 Framework Contract Q1.pdf   [Preview] [Download] [More ▼]    │
│  │    Ahmed Trading · v1 · 1.1 MB · Uploaded 03 Jan 2026           │
│  │    ● Clean                                                       │
│  │                                                                  │
│  INVOICES (1)                                                        │
│  ─────────────────────────────────────────────────                  │
│  │ 📄 Invoice-2026-0234.pdf       [Preview] [Download] [More ▼]    │
│  │    PO-2026-00123 · v1 · 840 KB · Uploaded Today                 │
│  │    ● Clean                                                       │
│  │                                                                  │
│  PHOTOS (3)                                                          │
│  ─────────────────────────────────────────────────                  │
│  │ [thumbnail]  [thumbnail]  [thumbnail]  ← Image grid             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Document Entry Anatomy

```
[Type Icon]  [Display Name]                [Preview]  [Download]  [More ▼]
             [Object name] · v[N] · [size] · [date]
             [Scan status badge]  [Tag 1]  [Tag 2]
```

**Document type icons:**
- PDF: red document icon
- Image: image icon
- Excel: green spreadsheet icon
- Word: blue document icon
- Generic: file icon

---

## 5. Upload Flow

### Single Upload

Clicking "+ Upload Document" or dropping a file:

```
Step 1: File Selection
  ┌──────────────────────────────────────────┐
  │  Drag & drop files here                  │
  │  or [Browse files]                       │
  │                                          │
  │  Accepted: PDF, Images, Excel, Word      │
  │  Max size: 25 MB per file                │
  └──────────────────────────────────────────┘

Step 2: File Details (slides in after selection)
  Display Name:  [__________________________]
  Category:      [Contract ▼]
  Tags:          [Add tags...]
  Description:   [Optional note...]
  
  [Cancel]                       [Upload]

Step 3: Upload Progress
  📄 Supply Agreement 2026.pdf
  [████████████████░░░░] 78%
  Scanning for viruses...

Step 4: Complete
  ✓ Uploaded and scanned clean
  Document added to the Timeline automatically
```

### Bulk Upload

Drag multiple files → all appear in Step 2 as a list; each can have its own details or a shared category applied to all.

---

## 6. Preview

Clicking "Preview" opens a **Document Preview Panel** that slides over the drawer content (does not close the drawer):

```
┌────────────────────────────────────────────────────────────────────────┐
│  ← Back  │  Invoice-2026-0234.pdf  │  v1  │  [Download] [More ▼] [✗] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [PDF/Image Preview Area]                                              │
│                                                                        │
│  Full in-browser preview. No download required.                       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Preview support:**
- PDF: in-browser PDF viewer (native or PDF.js)
- Images: full-size with zoom
- Excel / Word: read-only rendering or download prompt
- Unsupported types: file info + download button

---

## 7. Versioning

When a document is replaced with a new version:

```
[More ▼] → Upload new version

  ┌──────────────────────────────────────────┐
  │  Uploading new version of:               │
  │  Supply Agreement 2026.pdf               │
  │                                          │
  │  Change summary:  [_________________]   │
  │                                          │
  │  [Cancel]                  [Upload v3]  │
  └──────────────────────────────────────────┘
```

**Accessing version history:**
```
[More ▼] → Version History

  v3  · Current  · Uploaded Today  · 2.8 MB
  v2  · 12 Jan 2026               · 2.4 MB  [Download] [Preview]
  v1  · 03 Jan 2026               · 2.1 MB  [Download] [Preview]
```

---

## 8. Document Actions (More Menu)

```
[More ▼]
  ├── Preview
  ├── Download
  ├── Upload new version
  ├── Copy share link
  ├── Edit details (rename, tags, description)
  ├── ─────────────────
  ├── Archive
  └── Delete  (destructive; confirmation required)
```

---

## 9. Virus Scan Status

Every uploaded file goes through a virus scan (EPS-03 VirusScanHookContract).

| Status | Badge | Behavior |
|---|---|---|
| `pending` | ⏳ Scanning... | File is accessible but with a warning |
| `clean` | ● Clean | File is accessible; no warning |
| `quarantined` | ✗ Quarantined | File not accessible; admin notification triggered |
| `scan_skipped` | — Scan skipped | File accessible; audit note added |

---

## 10. Tags and Categories

Tags and categories help organize documents within a business object.

**Categories** are defined by the DocumentPolicy (per company configuration):
- Contracts
- Invoices
- Receipts
- Photos
- Quality Certificates
- Lab Reports
- Shipping Documents
- Legal Documents
- Other

**Tags** are free-form; entered by the user during upload or edit.

---

## 11. Permissions

Document permissions follow the object's permissions:
- **View**: any user with read access to the parent object
- **Upload**: any user with write access to the parent object
- **Delete**: only the uploader or users with admin/manager role
- **Version history**: same as View
- **Archive**: Manager role and above

---

## 12. Governance

| Rule | Constraint |
|---|---|
| UX-GOV-011 | Document UX is identical in every drawer — no module-specific document implementations |
| Storage | All uploads go through EPS-03 StorageAdapterContract; never directly to filesystem |
| Virus scan | Mandatory for all uploads; quarantined files must never be accessible to end users |
| Timeline integration | Every document upload/delete automatically creates a Timeline entry via EPS-02 |
| No inline embeds | Documents are never embedded in form fields (they are attachments, not fields) |
